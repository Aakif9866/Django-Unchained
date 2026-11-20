import { describe, expect, it } from "vitest";
import { LEVELS, budgetFor, newGame, nextLevel, parse, restart, solveMoves, step, undo, type CratesState } from "./logic";

describe("crates", () => {
  it("every level is solvable, in exactly its listed best", () => {
    LEVELS.forEach((lv) => {
      const p = parse(lv.map);
      expect(p.crates.length).toBe(p.marks.filter(Boolean).length);
      expect(solveMoves(lv.map)).toBe(lv.best);
    });
  });

  it("levels get harder", () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].best).toBeGreaterThanOrEqual(LEVELS[i - 1].best);
  });

  it("walks, pushes one crate, and is blocked by walls and crate pairs", () => {
    const s = newGame(); // level 1: you top-left, crate in the middle
    expect(step(s, "up")).toBeNull(); // wall
    expect(step(s, "right")).toEqual({ pushed: -1, solved: false });
    expect(step(s, "down")).toEqual({ pushed: 0, solved: false }); // pushes the crate down
    expect(s.crates[0]).toBe(parse(LEVELS[0].map).crates[0] + s.w);
    expect(step(s, "down")).toBeNull(); // crate against the wall
    const two = nextLevelFrom(1);
    two.me = two.crates[0] - 1;
    expect(step(two, "right")).toBeNull(); // can't push two crates
  });

  it("solves level 1 in its best, scores, and moves on", () => {
    const s = newGame();
    for (const d of ["right", "down", "left", "down", "right"] as const) step(s, d);
    expect(s.solved).toBe(true);
    expect(s.score).toBe(100 + 10 * (budgetFor(LEVELS[0].best) - 5));
    nextLevel(s);
    expect(s).toMatchObject({ level: 2, solved: false, moves: 0, history: [] });
  });

  it("undo and restart rewind the board but not the budget", () => {
    const s = newGame();
    const start = { me: s.me, crates: s.crates.slice() };
    step(s, "right");
    step(s, "down");
    expect(undo(s)).toBe(true);
    expect(s.crates).toEqual(start.crates);
    expect(s.budget).toBe(budgetFor(LEVELS[0].best) - 2);
    step(s, "down");
    expect(restart(s)).toBe(true);
    expect({ me: s.me, crates: s.crates }).toEqual(start);
    expect(s.moves).toBe(3);
  });

  it("running out of steps ends the run; the last level ends it with a bonus", () => {
    const s = newGame();
    while (s.alive) step(s, s.budget % 2 ? "right" : "left");
    expect(s.alive).toBe(false);
    expect(step(s, "down")).toBeNull();
    // Level 1's board, played as if it were the last level.
    const last = newGame();
    last.level = LEVELS.length;
    for (const d of ["right", "down", "left", "down", "right"] as const) step(last, d);
    expect(last.finished).toBe(true);
    expect(last.score).toBe(100 * LEVELS.length + 10 * last.budget + 500);
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame();
    step(s, "right");
    const copy = JSON.parse(JSON.stringify(s)) as CratesState;
    expect(step(copy, "down")).toEqual(step(s, "down"));
    expect(copy).toEqual(s);
  });
});

function nextLevelFrom(index: number): CratesState {
  const s = newGame();
  for (let i = 0; i < index; i++) {
    s.solved = true;
    nextLevel(s);
  }
  return s;
}
