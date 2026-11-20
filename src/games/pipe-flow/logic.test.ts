import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { DOWN, LEFT, RIGHT, UP, isSolved, newGame, nextLevel, reached, rotate, turn, turnsTo, type PipeState } from "./logic";

describe("pipe-flow", () => {
  it("turns a quarter clockwise", () => {
    expect(turn(UP)).toBe(RIGHT);
    expect(turn(LEFT)).toBe(UP);
    expect(turn(UP | DOWN)).toBe(RIGHT | LEFT);
    expect(turnsTo(UP | DOWN, UP | DOWN)).toBe(0);
    expect(turnsTo(RIGHT | LEFT, UP | DOWN)).toBe(1); // a straight never needs more than one turn
    expect(turnsTo(UP, LEFT)).toBe(3);
  });

  it("generates a full network with no crosses, scrambled but solvable within the budget", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rng = createRng(seed);
      let s = newGame(rng);
      for (let lv = 1; lv <= 7; lv++) {
        expect(s.tiles.every((t) => t > 0 && [1, 2, 4, 8].filter((b) => t & b).length <= 3)).toBe(true);
        expect(isSolved(s)).toBe(false);
        expect(s.movesLeft).toBeGreaterThan(s.par);
        // Turning every tile back to the generated layout solves it in exactly par moves.
        const copy = JSON.parse(JSON.stringify(s)) as PipeState;
        let used = 0;
        copy.tiles.forEach((t, i) => {
          for (let k = turnsTo(t, s.goal[i]); k > 0; k--, used++) rotate(copy, i);
        });
        expect(used).toBe(s.par);
        expect(copy.solved).toBe(true);
        s.solved = true;
        s = nextLevel(s, rng);
      }
    }
  });

  it("knows a solved board, and spots leaks", () => {
    // A 2 × 2 board with the source top-left.
    const s: PipeState = { ...newGame(createRng(1)), n: 2, source: 0, tiles: [RIGHT | DOWN, LEFT, UP, 0] };
    expect(isSolved(s)).toBe(false); // tile 3 is dry
    s.tiles[3] = 0;
    s.tiles = [RIGHT | DOWN, LEFT | DOWN, UP | RIGHT, UP | LEFT]; // a loop through all four
    expect(isSolved(s)).toBe(true);
    s.tiles[1] = LEFT | UP; // points off the board
    expect(isSolved(s)).toBe(false);
    expect(reached(s).size).toBe(4);
  });

  it("solving scores spare moves; running out ends the run", () => {
    const s: PipeState = { ...newGame(createRng(2)), n: 2, source: 0, tiles: [RIGHT | DOWN, LEFT | DOWN, UP | RIGHT, LEFT | DOWN], movesLeft: 5, level: 1, score: 0 };
    expect(rotate(s, 3)).toBe(true); // LEFT|DOWN → UP|LEFT
    expect(s.solved).toBe(true);
    expect(s.score).toBe(60 + 15 * 4);
    const t = newGame(createRng(3));
    t.movesLeft = 2;
    rotate(t, 0);
    rotate(t, 0);
    expect(t.solved || !t.alive).toBe(true);
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame(createRng(4));
    const copy = JSON.parse(JSON.stringify(s)) as PipeState;
    rotate(copy, 3);
    rotate(s, 3);
    expect(copy).toEqual(s);
  });
});
