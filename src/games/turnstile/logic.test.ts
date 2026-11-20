import { describe, expect, it } from "vitest";
import { LEVELS, groupsOf, newGame, nextLevel, parse, route, solveTaps, spin, tap, tapsFor, turn, type TurnState } from "./logic";

describe("turnstile", () => {
  it("every level starts blocked and is solvable in exactly its par", () => {
    LEVELS.forEach((lv) => {
      expect(route(parse(lv.map))).toBeNull();
      expect(solveTaps(lv.map)).toBe(lv.par);
    });
  });

  it("levels get harder", () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].par).toBeGreaterThanOrEqual(LEVELS[i - 1].par);
  });

  it("a tap turns every turnstile of that colour together", () => {
    const p = parse(LEVELS[7].map);
    const before = p.open.slice();
    spin(p.open, p.kinds, "a");
    p.kinds.forEach((k, i) => expect(p.open[i]).toBe(k === "a" ? turn(before[i]) : before[i]));
    expect(groupsOf(p.kinds)).toEqual(["a", "b", "c"]);
  });

  it("solving returns the bot's route home, scores spare taps, and moves on", () => {
    const s = newGame(); // "S # aI2 # G": one tap lays the straight across
    const cell = s.kinds.indexOf("a");
    const path = tap(s, cell)!;
    expect(path[0]).toBe(s.start);
    expect(path[path.length - 1]).toBe(s.goal);
    expect(path).toHaveLength(5);
    expect(s.score).toBe(100 + 25 * (tapsFor(1) - 1));
    expect(tap(s, cell)).toBeNull(); // solved: taps do nothing
    nextLevel(s);
    expect(s).toMatchObject({ level: 2, solved: false, taps: tapsFor(2) });
  });

  it("floor can't be tapped; running out of taps ends the run; the last level ends it", () => {
    const s = newGame();
    expect(tap(s, s.start)).toBeNull();
    const t = nextLevelFrom(2); // level 3: one group, a 3-cycle away from solved
    const a = t.kinds.indexOf("a");
    while (t.alive && !t.solved) tap(t, a);
    expect(t.solved).toBe(true); // a single group always comes round
    const u = nextLevelFrom(LEVELS.length - 1);
    u.taps = 1;
    tap(u, u.kinds.indexOf("d"));
    expect(u.alive).toBe(false);
    const last = newGame();
    last.level = LEVELS.length;
    tap(last, last.kinds.indexOf("a"));
    expect(last.finished).toBe(true);
  });

  it("survives a snapshot round-trip", () => {
    const s = nextLevelFrom(5);
    const copy = JSON.parse(JSON.stringify(s)) as TurnState;
    const b = s.kinds.indexOf("b");
    expect(tap(copy, b)).toEqual(tap(s, b));
    expect(copy).toEqual(s);
  });
});

function nextLevelFrom(index: number): TurnState {
  const s = newGame();
  for (let i = 0; i < index; i++) {
    s.solved = true;
    nextLevel(s);
  }
  return s;
}
