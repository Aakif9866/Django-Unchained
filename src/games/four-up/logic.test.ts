import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { COLS, LINES, ROWS, drop, newGame, nextGame, think, winLine, type FourState } from "./logic";

const cell = (r: number, c: number) => r * COLS + c;
const playCols = (s: FourState, cols: number[]) => cols.forEach((c) => expect(drop(s, c)).toBeGreaterThanOrEqual(0));
const engine = (s: FourState, level: number) => {
  let t = 0;
  return think(s.grid, s.turn, level, createRng(3), () => (t += 50)).move; // fake clock: ~25 polls of 1024 nodes
};

describe("four-up: rules", () => {
  it("has 69 lines of four", () => expect(LINES).toHaveLength(69));

  it("stacks discs from the bottom and refuses a full column", () => {
    const s = newGame();
    expect(drop(s, 3)).toBe(cell(0, 3));
    expect(drop(s, 3)).toBe(cell(1, 3));
    expect(s.grid[cell(0, 3)]).toBe(1);
    expect(s.grid[cell(1, 3)]).toBe(-1);
    playCols(s, [3, 3, 3, 3]);
    expect(drop(s, 3)).toBe(-1);
    expect(drop(s, 9)).toBe(-1);
  });

  it("spots a win in every direction", () => {
    const at = (cells: [number, number][]) => {
      const g = Array(ROWS * COLS).fill(0);
      cells.forEach(([r, c]) => (g[cell(r, c)] = 1));
      return winLine(g, cell(...cells[cells.length - 1])).length;
    };
    expect(at([[0, 0], [0, 1], [0, 2], [0, 3]])).toBe(4); // across
    expect(at([[0, 6], [1, 6], [2, 6], [3, 6]])).toBe(4); // up
    expect(at([[0, 0], [1, 1], [2, 2], [3, 3]])).toBe(4); // diagonal /
    expect(at([[2, 6], [3, 5], [4, 4], [5, 3]])).toBe(4); // diagonal \
    expect(at([[0, 0], [0, 1], [0, 2]])).toBe(0);
    expect(at([[0, 0], [0, 1], [0, 2], [0, 4], [0, 3]])).toBe(5); // a five counts every cell
  });

  it("calls a draw when the board fills with no four", () => {
    // Pairs that alternate row by row never line up four in any direction.
    const s = newGame();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) s.grid[cell(r, c)] = ((c >> 1) + r) % 2 === 0 ? 1 : -1;
    s.grid[cell(5, 6)] = 0;
    s.ply = ROWS * COLS - 1;
    s.turn = 1;
    drop(s, 6);
    expect(s.line).toEqual([]);
    expect(s.result).toEqual({ kind: "draw", points: 100 });
  });
});

describe("four-up: engine", () => {
  it("takes a winning drop at every level", () => {
    for (let level = 1; level <= 4; level++) {
      const s = newGame();
      playCols(s, [0, 6, 1, 6, 2, 5]); // side 1 threatens column 3; it's side 1 to move
      expect(engine(s, level)).toBe(3);
    }
  });

  it("blocks your open three from Novice up", () => {
    for (let level = 1; level <= 4; level++) {
      const s = newGame();
      playCols(s, [0, 6, 1, 6, 2]); // side 1 has three across; the engine (side -1) must take column 3
      expect(engine(s, level)).toBe(3);
    }
  });

  it("opens in the centre at Master", () => {
    expect(engine(newGame(), 4)).toBe(3);
  });

  it("answers within the time budget on a busy board", () => {
    const s = newGame();
    playCols(s, [3, 3, 2, 4, 4, 2, 1, 5]);
    expect(engine(s, 4)).toBeGreaterThanOrEqual(0);
  });
});

describe("four-up: ladder", () => {
  it("a win scores more the quicker it is, then levels up and hands over the first move", () => {
    const s = newGame();
    playCols(s, [0, 6, 1, 6, 2, 6, 3]);
    expect(s.result).toEqual({ kind: "win", points: (200 + 5 * 35) * 1 });
    expect(s.line.sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(drop(s, 5)).toBe(-1); // game's over
    nextGame(s);
    expect(s).toMatchObject({ level: 2, games: 1, you: -1, turn: 1, ply: 0, last: -1, line: [], result: null });
  });

  it("a loss ends the run", () => {
    const s = newGame();
    playCols(s, [0, 6, 1, 6, 2, 6, 5, 6]); // the engine (side -1) stacks four in column 6
    expect(s.result?.kind).toBe("loss");
    nextGame(s);
    expect(s.games).toBe(0);
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame();
    playCols(s, [3, 2, 3]);
    const copy = JSON.parse(JSON.stringify(s)) as FourState;
    expect(engine(copy, 2)).toBe(engine(s, 2));
    expect(drop(copy, 3)).toBe(drop(s, 3));
    expect(copy).toEqual(s);
  });
});
