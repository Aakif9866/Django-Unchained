import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { count, flipsFor, movesFor, newGame, nextGame, place, think, type ReversiState } from "./logic";

const sq = (name: string) => (Number(name[1]) - 1) * 8 + (name.charCodeAt(0) - 97); // a1 top-left, like Othello notation
const empty = (s: ReversiState) => s.board.fill(0);
const engine = (s: ReversiState, level: number, seed = 5) => {
  let t = 0;
  return think(s.board, s.turn, level, createRng(seed), () => (t += 40)).move;
};

describe("reversi: rules", () => {
  it("opens with four moves for black", () => {
    const s = newGame();
    expect(movesFor(s.board, 1).sort((a, b) => a - b)).toEqual([sq("d3"), sq("c4"), sq("f5"), sq("e6")].sort((a, b) => a - b));
    expect(count(s.board, 1)).toBe(2);
    expect(count(s.board, -1)).toBe(2);
  });

  it("flips every bracketed line at once", () => {
    const s = newGame();
    empty(s);
    // c3 is ringed by white, with black just beyond in all eight directions.
    for (const n of ["b2", "c2", "d2", "b3", "d3", "b4", "c4", "d4"]) s.board[sq(n)] = -1; // white ring around c3
    for (const n of ["a1", "c1", "e1", "a3", "e3", "a5", "c5", "e5"]) s.board[sq(n)] = 1; // black beyond each
    expect(flipsFor(s.board, sq("c3"), 1).length).toBe(8);
    expect(flipsFor(s.board, sq("c3"), -1)).toEqual([]); // white can't bracket its own
    expect(flipsFor(s.board, sq("c1"), 1)).toEqual([]); // occupied
  });

  it("scores your flips and hands the turn over", () => {
    const s = newGame();
    const flips = place(s, sq("d3"));
    expect(flips).toEqual([sq("d4")]);
    expect(s.turn).toBe(-1);
    expect(s.score).toBe(1);
    expect(place(s, sq("a1"))).toBeNull();
  });

  it("passes when the other side has no move", () => {
    const s = newGame();
    empty(s);
    s.board[sq("a1")] = 1;
    s.board[sq("b1")] = -1;
    s.board[sq("g8")] = -1;
    s.board[sq("h8")] = 1;
    place(s, sq("c1")); // white is left with no move at all; black still has f8
    expect(s.passed).toBe(-1);
    expect(s.turn).toBe(1);
    expect(s.result).toBeNull();
    place(s, sq("f8"));
    expect(s.result).toMatchObject({ kind: "win", you: 6, them: 0, points: 300 });
  });

  it("ends when neither side can move, and a loss ends the run", () => {
    const s = newGame();
    s.you = -1; // you are white this time
    empty(s);
    s.board[sq("a1")] = 1;
    s.board[sq("b1")] = -1;
    place(s, sq("c1"));
    expect(s.result).toMatchObject({ kind: "loss", you: 0, them: 3 });
    nextGame(s);
    expect(s.games).toBe(0);
  });
});

describe("reversi: engine", () => {
  it("grabs a corner when it can", () => {
    const s = newGame();
    s.board[sq("b1")] = -1;
    s.board[sq("c1")] = 1;
    for (let level = 2; level <= 4; level++) expect(engine(s, level)).toBe(sq("a1"));
  });

  it("plays a whole game against itself to a result", () => {
    const s = newGame();
    const rng = createRng(11);
    for (let i = 0; i < 80 && !s.result; i++) {
      const level = s.turn === 1 ? 4 : 1;
      expect(place(s, think(s.board, s.turn, level, rng, (() => { let t = 0; return () => (t += 200); })()).move)).not.toBeNull();
    }
    expect(s.result).not.toBeNull();
    expect(s.result!.you + s.result!.them).toBeLessThanOrEqual(64);
    expect(s.result!.kind).toBe("win"); // Master (black, you) beats Novice
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame();
    place(s, sq("d3"));
    place(s, sq("c3"));
    const copy = JSON.parse(JSON.stringify(s)) as ReversiState;
    expect(engine(copy, 3)).toBe(engine(s, 3));
    expect(place(copy, sq("c4"))).toEqual(place(s, sq("c4")));
    expect(copy).toEqual(s);
  });
});

describe("reversi: ladder", () => {
  it("a win levels up and swaps colours", () => {
    const s = newGame();
    empty(s);
    s.board[sq("a1")] = 1;
    s.board[sq("b1")] = -1;
    place(s, sq("c1"));
    expect(s.result?.kind).toBe("win");
    nextGame(s);
    expect(s).toMatchObject({ level: 2, games: 1, you: -1, turn: 1, ply: 0, passed: 0, result: null });
    expect(count(s.board, 1) + count(s.board, -1)).toBe(4);
  });
});
