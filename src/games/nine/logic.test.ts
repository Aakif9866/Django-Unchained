import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { MAX_MISTAKES, PEERS, countSolutions, newGame, nextPuzzle, place, singlesSolve, toggleNote, type NineState } from "./logic";

describe("nine", () => {
  it("every cell has 20 peers", () => expect(PEERS.every((p) => p.length === 20)).toBe(true));

  it("generates valid puzzles with exactly one solution", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const rng = createRng(seed);
      let s = newGame(rng);
      for (let lv = 1; lv <= 3; lv++) {
        // A valid full grid: every row, column and box holds 1–9.
        for (let i = 0; i < 81; i++) expect(PEERS[i].every((j) => s.solution[j] !== s.solution[i])).toBe(true);
        expect(countSolutions(s.givens, 2).count).toBe(1);
        expect(s.givens.every((v, i) => !v || v === s.solution[i])).toBe(true);
        s.solved = true;
        s = nextPuzzle(s, rng);
      }
    }
  });

  it("later puzzles give fewer clues", () => {
    const rng = createRng(9);
    const s = newGame(rng);
    const first = s.givens.filter(Boolean).length;
    for (let i = 0; i < 6; i++) nextPuzzle(s, rng);
    expect(s.givens.filter(Boolean).length).toBeLessThan(first);
  });

  it("grades a singles-only puzzle as Gentle", () => {
    const s = newGame(createRng(2));
    expect(s.grade).toBe(singlesSolve(s.givens) ? "Gentle" : "Tricky");
    const nearlyDone = s.solution.slice();
    nearlyDone[0] = 0;
    expect(singlesSolve(nearlyDone)).toBe(true);
  });

  it("right numbers score and clear notes; wrong ones are mistakes, and three end the run", () => {
    const s = newGame(createRng(3));
    const empty = s.grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const [a, b] = empty;
    const d = s.solution[a];
    const peer = PEERS[a].find((j) => !s.grid[j])!;
    toggleNote(s, peer, d);
    expect(place(s, a, d)).toBe("right");
    expect(s.notes[peer] & (1 << d)).toBe(0);
    expect(s.score).toBe(5);
    expect(place(s, a, d)).toBeNull(); // already right
    const wrong = (s.solution[b] % 9) + 1;
    for (let k = 0; k < MAX_MISTAKES; k++) expect(place(s, b, wrong)).toBe("wrong");
    expect(s.alive).toBe(false);
  });

  it("filling the last cell solves the puzzle with a bonus", () => {
    const s = newGame(createRng(4));
    const empty = s.grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    let last = null;
    for (const i of empty) last = place(s, i, s.solution[i]);
    expect(last).toBe("solved");
    expect(s.score).toBe(5 * empty.length + (s.grade === "Tricky" ? 400 : 250));
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame(createRng(5));
    const i = s.grid.findIndex((v) => !v);
    const copy = JSON.parse(JSON.stringify(s)) as NineState;
    expect(place(copy, i, s.solution[i])).toBe(place(s, i, s.solution[i]));
    expect(copy).toEqual(s);
  });
});
