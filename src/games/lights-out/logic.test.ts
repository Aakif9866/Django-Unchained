import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { newGame, nextLevel, press, sizeFor, solve, tap, type LightsState } from "./logic";

describe("lights-out", () => {
  it("a press flips the cell and its four neighbours, clipped at the edges", () => {
    const l = Array(25).fill(0);
    press(l, 5, 0);
    expect(l.flatMap((v, i) => (v ? [i] : []))).toEqual([0, 1, 5]);
    press(l, 5, 12);
    expect(l.filter(Boolean)).toHaveLength(8);
  });

  it("solves every generated puzzle, and the solution really works", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed);
      let s = newGame(rng);
      for (let lv = 1; lv <= 8; lv++) {
        const fix = solve(s.lights, s.n)!;
        expect(fix.length).toBe(s.par);
        const l = s.lights.slice();
        fix.forEach((c) => press(l, s.n, c));
        expect(l.every((v) => !v)).toBe(true);
        expect(s.movesLeft).toBeGreaterThan(s.par);
        s.solved = true;
        s = nextLevel(s, rng);
      }
    }
  });

  it("finds the lightest solution, and knows an unsolvable board", () => {
    const l = Array(25).fill(0);
    press(l, 5, 7);
    press(l, 5, 18);
    expect(solve(l, 5)!.sort((a, b) => a - b)).toEqual([7, 18]);
    const odd = Array(25).fill(0);
    odd[0] = 1; // a single corner light can't be solved on 5 × 5
    expect(solve(odd, 5)).toBeNull();
  });

  it("solving scores the moves you didn't need; running out ends the run", () => {
    const s = newGame(createRng(4));
    for (const c of solve(s.lights, s.n)!) tap(s, c);
    expect(s.solved).toBe(true);
    expect(s.score).toBe(50 + 20 * (s.movesLeft));
    const t = newGame(createRng(5));
    while (t.alive && !t.solved) tap(t, 24); // pressing one cell over and over never solves it here
    expect(t.alive).toBe(false);
    expect(tap(t, 3)).toBe(false);
  });

  it("boards grow", () => {
    expect([1, 4, 7].map(sizeFor)).toEqual([5, 6, 7]);
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame(createRng(6));
    tap(s, 3);
    const copy = JSON.parse(JSON.stringify(s)) as LightsState;
    tap(copy, 9);
    tap(s, 9);
    expect(copy).toEqual(s);
  });
});
