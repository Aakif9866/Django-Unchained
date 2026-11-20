import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { hasPrefix, isWord, makeDict, newGame, nextRound, pathFor, pointsFor, solve, tick, trace, type HuntState } from "./logic";

const small = makeDict(["cat", "cart", "art", "tar", "rat", "star", "arts"].join("\n"));
// The real bundled list, as the game loads it.
const real = makeDict(readFileSync(new URL("../../../public/words.txt", import.meta.url), "utf8"));
const grid = ["c", "a", "r", "t", "x", "s", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x"];

describe("word-hunt", () => {
  it("knows words, plurals and prefixes", () => {
    expect(isWord(small, "cart")).toBe(true);
    expect(isWord(small, "carts")).toBe(true); // plural of a listed word
    expect(isWord(small, "ca")).toBe(false);
    expect(hasPrefix(small, "ca")).toBe(true);
    expect(hasPrefix(small, "cz")).toBe(false);
    expect(isWord(real, "dinghy")).toBe(true);
    expect(real.words.length).toBeGreaterThan(70000);
  });

  it("scores by length", () => {
    expect(["cat", "cart", "carts", "garden", "gardens", "gardener"].map(pointsFor)).toEqual([1, 1, 2, 3, 5, 11]);
  });

  it("finds every word in a grid, and the path for any of them", () => {
    const words = solve(grid, small);
    expect([...words].sort()).toEqual(["art", "cart"]); // c-a-r-t runs along the top; nothing else connects
    const p = pathFor(grid, "cart")!;
    expect(p.map((i) => grid[i]).join("")).toBe("cart");
    expect(pathFor(grid, "star")).toBeNull(); // the s isn't next to the t
  });

  it("generated grids hold plenty of words", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = newGame(createRng(seed), real);
      expect(s.possible).toBeGreaterThanOrEqual(25);
      expect(s.grid).toHaveLength(16);
    }
  });

  it("traced words score once; bad paths and non-words don't", () => {
    const s: HuntState = { ...newGame(createRng(1), real), grid: grid.slice() };
    expect(trace(s, pathFor(grid, "cart")!, small)).toBe("word");
    expect(s.points).toBe(1);
    expect(trace(s, pathFor(grid, "cart")!, small)).toBe("dup");
    expect(trace(s, [0, 1], small)).toBe("short");
    expect(trace(s, [0, 3, 2], small)).toBeNull(); // 0 and 3 aren't neighbours
    expect(trace(s, [0, 1, 0], small)).toBeNull(); // a cell twice
  });

  it("a round ends on time: the target moves you on, missing it ends the run", () => {
    const rng = createRng(2);
    const s = newGame(rng, real);
    s.points = s.target;
    tick(s, 999);
    expect(s.roundOver).toBe(true);
    expect(s.alive).toBe(true);
    nextRound(s, rng, real);
    expect(s).toMatchObject({ level: 2, roundOver: false, found: [] });
    tick(s, 999);
    expect(s.alive).toBe(false);
  });

  it("survives a snapshot round-trip", () => {
    const s: HuntState = { ...newGame(createRng(3), real), grid: grid.slice() };
    const copy = JSON.parse(JSON.stringify(s)) as HuntState;
    expect(trace(copy, pathFor(grid, "rat") ?? [1, 2, 3], small)).toEqual(trace(s, pathFor(grid, "rat") ?? [1, 2, 3], small));
    expect(copy).toEqual(s);
  });
});
