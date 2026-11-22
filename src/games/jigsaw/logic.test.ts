import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { bringToFront, createPuzzle, drop, hint, placed, scatter, sides, tick, timeBonus, type JigsawState } from "./logic";

const fresh = (level: 0 | 1 | 2 = 1, seed = 7) => {
  const rng = createRng(seed);
  const s = createPuzzle(rng, level);
  scatter(s, rng, { x: 0, y: s.rows + 0.5, w: s.cols, h: 4 });
  return s;
};

describe("jigsaw", () => {
  it("cuts 12 / 24 / 48 pieces by difficulty", () => {
    expect([0, 1, 2].map((l) => fresh(l as 0 | 1 | 2).pieces.length)).toEqual([12, 24, 48]);
  });

  it("picks one of thousands of heroes from the seed", () => {
    const seeds = new Set(Array.from({ length: 50 }, (_, k) => fresh(1, k).seed));
    expect(seeds.size).toBeGreaterThan(45);
    for (const x of seeds) expect(x >= 1 && x <= 9999).toBe(true);
  });

  it("neighbouring edges fit: a tab meets a blank, borders are flat", () => {
    const s = fresh(2);
    for (let i = 0; i < s.pieces.length; i++) {
      const c = i % s.cols, r = Math.floor(i / s.cols);
      const [t, rt, b, l] = sides(s, i);
      if (c < s.cols - 1) expect(rt).toBe(-sides(s, i + 1)[3]);
      if (r < s.rows - 1) expect(b).toBe(-sides(s, i + s.cols)[0]);
      expect(r === 0 ? t === 0 : t !== 0).toBe(true);
      expect(c === 0 ? l === 0 : l !== 0).toBe(true);
    }
  });

  it("scatters loose pieces inside the tray", () => {
    const s = fresh();
    for (const p of s.pieces) expect(p.y).toBeGreaterThanOrEqual(s.rows + 0.5);
  });

  it("snaps a piece dropped near home and locks it", () => {
    const s = fresh();
    expect(drop(s, 7, 1 + 0.2, 1 - 0.2)).toBe(true);
    expect(s.pieces[7]).toEqual({ x: 1, y: 1, done: true });
    expect(s.score).toBe(10);
    expect(drop(s, 7, 4, 4)).toBe(false);
    expect(s.pieces[7].x).toBe(1);
  });

  it("leaves a piece where it was dropped when it's too far", () => {
    const s = fresh();
    expect(drop(s, 0, 0.5, 0.1)).toBe(false);
    expect(s.pieces[0]).toEqual({ x: 0.5, y: 0.1, done: false });
    expect(s.score).toBe(0);
  });

  it("solves when every piece is home and banks the time bonus", () => {
    const s = fresh(0);
    tick(s, 30);
    const bonus = timeBonus(s);
    expect(bonus).toBe((12 * 8 - 30) * 2);
    s.pieces.forEach((_, i) => drop(s, i, i % s.cols, Math.floor(i / s.cols)));
    expect(s.solved).toBe(true);
    expect(s.score).toBe(120 + bonus);
    tick(s, 10);
    expect(s.time).toBe(30); // the clock stops once solved
  });

  it("hint places a piece for free", () => {
    const s = fresh();
    const i = hint(s);
    expect(s.pieces[i].done).toBe(true);
    expect(s.score).toBe(0);
    expect(placed(s)).toBe(1);
  });

  it("bringToFront moves a piece to the top of the stack", () => {
    const s = fresh();
    bringToFront(s, 3);
    expect(s.order.at(-1)).toBe(3);
    expect(s.order.length).toBe(24);
  });

  it("survives a snapshot round-trip", () => {
    const a = fresh();
    drop(a, 2, 2, 0);
    const b = JSON.parse(JSON.stringify(a)) as JigsawState;
    expect(drop(a, 5, 5 % a.cols, 0)).toBe(drop(b, 5, 5 % b.cols, 0));
    expect(b).toEqual(a);
  });
});
