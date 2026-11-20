import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { CROSS, FILL, MAX_MISTAKES, clueOf, lineDone, lineSolve, mark, newGame, nextPuzzle, solveLine, type NonoState } from "./logic";

describe("nonogram", () => {
  it("reads clues from a line", () => {
    expect(clueOf([1, 1, 0, 1, 0, 0, 1, 1, 1])).toEqual([2, 1, 3]);
    expect(clueOf([0, 0, 0])).toEqual([]);
  });

  it("the line solver finds forced cells", () => {
    expect(solveLine([5], Array(5).fill(-1))).toEqual([1, 1, 1, 1, 1]);
    expect(solveLine([3], Array(5).fill(-1))).toEqual([-1, -1, 1, -1, -1]); // the overlap
    expect(solveLine([], Array(4).fill(-1))).toEqual([0, 0, 0, 0]);
    expect(solveLine([1, 1], [-1, 1, -1, -1])).toEqual([0, 1, 0, 1]); // the second block can only go last
    expect(solveLine([1, 1], Array(5).fill(-1))).toEqual([-1, -1, -1, -1, -1]);
    expect(solveLine([2], [1, 0, -1, -1])).toBeNull();
  });

  it("only keeps puzzles a line solver can finish, so each has one answer", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const rng = createRng(seed);
      let s = newGame(rng);
      for (let lv = 1; lv <= 6; lv++) {
        expect(lineSolve(s.rows, s.cols)).toEqual(s.solution);
        s.solved = true;
        s = nextPuzzle(s, rng);
      }
      expect(s.n).toBe(10);
    }
  });

  it("a wrong call is a mistake that reveals the cell; three end the run", () => {
    const s = newGame(createRng(3));
    const blanks = s.solution.flatMap((v, i) => (v ? [] : [i]));
    expect(mark(s, blanks[0], FILL)).toBe("mistake");
    expect(s.marks[blanks[0]]).toBe(CROSS);
    expect(mark(s, blanks[0], FILL)).toBeNull(); // already settled
    mark(s, blanks[1], FILL);
    mark(s, blanks[2], FILL);
    expect(s.mistakes).toBe(MAX_MISTAKES);
    expect(s.alive).toBe(false);
  });

  it("filling every picture cell solves it", () => {
    const s = newGame(createRng(4));
    const cells = s.solution.flatMap((v, i) => (v ? [i] : []));
    let last = null;
    for (const c of cells) last = mark(s, c, FILL);
    expect(last).toBe("solved");
    expect(s.score).toBe(2 * cells.length + 150);
    expect(lineDone(s, true, 0)).toBe(true);
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame(createRng(5));
    const c = s.solution.indexOf(1);
    const copy = JSON.parse(JSON.stringify(s)) as NonoState;
    expect(mark(copy, c, FILL)).toBe(mark(s, c, FILL));
    expect(copy).toEqual(s);
  });
});
