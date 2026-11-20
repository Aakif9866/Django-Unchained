import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { CLOSED, FLAG, OPEN, dig, flag, flagsLeft, minesAround, neighbours, newGame, nextBoard, sizeFor, type MineState } from "./logic";

/** A hand-laid 4 × 3 board. */
const fixed = (mineCells: number[]): MineState => {
  const s: MineState = { ...newGame(), cols: 4, rows: 3, count: mineCells.length, marks: Array(12).fill(CLOSED) };
  s.mines = Array(12).fill(0);
  mineCells.forEach((i) => (s.mines![i] = 1));
  return s;
};

describe("minefield", () => {
  it("never lays a mine on or next to the first dig, which always opens an area", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = newGame();
      const first = 37;
      const d = dig(s, first, createRng(seed));
      expect(d.boom).toBe(false);
      for (const i of [first, ...neighbours(s, first)]) expect(s.mines![i]).toBe(0);
      expect(d.opened.length).toBeGreaterThan(1);
      expect(s.mines!.reduce((a, b) => a + b, 0)).toBe(s.count);
    }
  });

  it("flood-fills zeros and stops at numbers", () => {
    const s = fixed([3]); // mine top-right
    const d = dig(s, 8, createRng(1));
    expect(d.opened.length).toBe(11); // everything but the mine
    expect(d.cleared).toBe(true);
    expect(s.marks[3]).toBe(FLAG);
    expect(s.score).toBe(11 + 100);
  });

  it("a number opens only itself", () => {
    const s = fixed([3, 11]);
    expect(minesAround(s, 2)).toBe(1);
    expect(dig(s, 2, createRng(1)).opened.map((o) => o.cell)).toEqual([2]);
  });

  it("chords when the flags add up, and blows up on a wrong flag", () => {
    const s = fixed([3, 11]);
    dig(s, 2, createRng(1));
    expect(dig(s, 2, createRng(1)).opened).toEqual([]); // no flags yet
    flag(s, 3);
    const d = dig(s, 2, createRng(1));
    expect(d.boom).toBe(false);
    expect(s.marks[6]).toBe(OPEN);
    const t = fixed([3, 11]);
    dig(t, 2, createRng(1));
    flag(t, 1); // wrong
    expect(dig(t, 2, createRng(1)).boom).toBe(true);
    expect(t.alive).toBe(false);
    expect(t.boom).toBe(3);
  });

  it("flags toggle, can't be dug, and count down", () => {
    const s = fixed([3, 11]);
    expect(flag(s, 0)).toBe(true);
    expect(flagsLeft(s)).toBe(1);
    expect(dig(s, 0, createRng(1)).opened).toEqual([]);
    flag(s, 0);
    expect(s.marks[0]).toBe(CLOSED);
  });

  it("boards grow and get denser", () => {
    const a = sizeFor(1), b = sizeFor(4);
    expect(b.rows).toBeGreaterThan(a.rows);
    expect(b.count / (b.cols * b.rows)).toBeGreaterThan(a.count / (a.cols * a.rows));
    const s = fixed([3]);
    dig(s, 8, createRng(1));
    nextBoard(s);
    expect(s).toMatchObject({ level: 2, score: 111, mines: null, cleared: false, alive: true });
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame();
    dig(s, 40, createRng(3));
    const copy = JSON.parse(JSON.stringify(s)) as MineState;
    const target = s.marks.findIndex((m, i) => m === CLOSED && !s.mines![i]);
    expect(dig(copy, target, createRng(4))).toEqual(dig(s, target, createRng(4)));
    expect(copy).toEqual(s);
  });
});
