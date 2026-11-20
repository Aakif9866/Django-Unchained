import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { canMove, maxTile, move, newGame, undo, type T48State } from "./logic";

const withBoard = (board: number[]): T48State => ({ board, score: 0, moves: 0, won: false, over: false, undo: null });
const row = (s: T48State, r: number) => s.board.slice(r * 4, r * 4 + 4);

describe("twenty48", () => {
  it("starts with two tiles", () => {
    const s = newGame(createRng(1));
    expect(s.board.filter(Boolean)).toHaveLength(2);
    expect(s.board.filter(Boolean).every((v) => v === 2 || v === 4)).toBe(true);
  });

  it("merges each tile once per move, toward the edge", () => {
    const rng = createRng(2);
    const s = withBoard([2, 2, 2, 2, 4, 4, 8, 0, 2, 0, 2, 4, 0, 0, 0, 2]);
    const m = move(s, "left", rng)!;
    expect(row(s, 0).slice(0, 2)).toEqual([4, 4]); // the spawn may land in any gap, so only check the packed cells
    expect(row(s, 1).slice(0, 2)).toEqual([8, 8]);
    expect(row(s, 2).slice(0, 2)).toEqual([4, 4]);
    expect(row(s, 3)[0]).toBe(2);
    expect(m.gained).toBe(4 + 4 + 8 + 4);
    expect(s.score).toBe(20);
    expect(m.merges.sort((a, b) => a - b)).toEqual([0, 1, 4, 8]);
    expect(s.board.filter(Boolean)).toHaveLength(8); // 7 tiles after merging + 1 spawn
  });

  it("does nothing (and spawns nothing) when no tile can move", () => {
    const s = withBoard([2, 4, 0, 0, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(move(s, "left", createRng(3))).toBeNull();
    expect(move(s, "up", createRng(3))).toBeNull();
    expect(s.moves).toBe(0);
  });

  it("slides in all four directions", () => {
    const at = (dir: "up" | "down" | "left" | "right") => {
      const s = withBoard([0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      const m = move(s, dir, createRng(4))!;
      return m.slides[0].to;
    };
    expect(at("left")).toBe(4);
    expect(at("right")).toBe(7);
    expect(at("up")).toBe(1);
    expect(at("down")).toBe(13);
  });

  it("flags 2048 once and keeps playing", () => {
    const s = withBoard([1024, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(move(s, "left", createRng(5))!.reachedGoal).toBe(true);
    expect(s.won).toBe(true);
    expect(maxTile(s.board)).toBe(2048);
    expect(s.over).toBe(false);
  });

  it("ends when the board is full and nothing merges", () => {
    const full = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(canMove(full)).toBe(false);
    expect(canMove([...full.slice(0, 15), 0])).toBe(true);
    const s = withBoard([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 8, 8]);
    move(s, "right", createRng(6));
    // after 8+8 merges, a tile spawns in the gap; whether it's over depends on that tile
    expect(s.over).toBe(!canMove(s.board));
  });

  it("undo rewinds one move, including the next spawn", () => {
    const rng = createRng(7);
    const start = [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const s = withBoard(start.slice());
    move(s, "left", rng);
    const after = s.board.slice();
    expect(undo(s, rng)).toBe(true);
    expect(s.board).toEqual(start);
    expect(s.moves).toBe(0);
    expect(undo(s, rng)).toBe(false); // one step only
    move(s, "left", rng);
    expect(s.board).toEqual(after); // same move, same spawn: no fishing
  });

  it("survives a snapshot round-trip", () => {
    const rng = createRng(8);
    const s = newGame(rng);
    for (const d of ["left", "up", "right", "down"] as const) move(s, d, rng);
    const copy = JSON.parse(JSON.stringify(s)) as T48State;
    const r1 = createRng(99), r2 = createRng(99);
    expect(move(copy, "left", r1)).toEqual(move(s, "left", r2));
    expect(copy).toEqual(s);
  });
});
