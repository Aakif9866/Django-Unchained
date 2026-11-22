/** Easy / Medium / Hard: each game's rule moves the right way, and Medium matches the original tuning. */
import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { paddleW, newGame as brick } from "./brickline/logic";
import { gapFor, newGame as flutter } from "./flutter/logic";
import { newGame as fourUp } from "./four-up/logic";
import { bombChance } from "./fruit-slice/logic";
import { sizeFor as mineSize, newGame as mines } from "./minefield/logic";
import { newGame as nine } from "./nine/logic";
import { maxMistakes, newGame as nono } from "./nonogram/logic";
import { sizeFor as pairsSize } from "./pairs/logic";
import { aiFor as puckAi, newGame as puck } from "./puck/logic";
import { aiFor as rallyAi, newGame as rally } from "./rally/logic";
import { newGame as reversi } from "./reversi/logic";
import { PASSES, passesFor, newGame as sol } from "./solitaire/logic";
import { gravity, newGame as stack } from "./stack-fall/logic";
import { newGame as tiles } from "./tiles/logic";
import { newGame as t48, undo, move } from "./twenty48/logic";
import { roundTime } from "./word-hunt/logic";

const rng = () => createRng(42);
const clues = (g: number[]) => g.filter(Boolean).length;

describe("difficulty", () => {
  it("Minefield: more mines on Hard", () => {
    expect(mineSize(1, 0).count).toBeLessThan(mineSize(1, 1).count);
    expect(mineSize(1, 2).count).toBeGreaterThan(mineSize(1, 1).count);
    expect(mines(2).count).toBe(mineSize(1, 2).count);
  });
  it("Nine: fewer clues on Hard", () => {
    expect(clues(nine(rng(), 0).givens)).toBeGreaterThan(clues(nine(rng(), 2).givens));
  });
  it("Nonogram: 5 / 3 / 1 mistakes", () => {
    expect([0, 1, 2].map((d) => maxMistakes(nono(rng(), d)))).toEqual([5, 3, 1]);
  });
  it("Tiles: 3 / 2 / 1 shuffles", () => {
    expect([0, 1, 2].map((d) => tiles(rng(), d).shuffles)).toEqual([3, 2, 1]);
  });
  it("Pairs and Word Hunt: less time on Hard", () => {
    expect(pairsSize(1, 0).time).toBeGreaterThan(pairsSize(1, 1).time);
    expect(pairsSize(1, 2).time).toBeLessThan(pairsSize(1, 1).time);
    expect([0, 1, 2].map(roundTime)).toEqual([150, 120, 90]);
  });
  it("Solitaire: fewer passes through the stock on Hard", () => {
    expect(PASSES[0]).toBeGreaterThan(PASSES[1]);
    expect(passesFor(sol(rng(), 2))).toBe(2);
  });
  it("Twenty48: no undo on Hard", () => {
    const r = rng();
    const s = t48(r, 2);
    for (const dir of ["left", "right", "up", "down"] as const) if (move(s, dir, r)) break;
    expect(undo(s, r)).toBe(false);
  });
  it("Board games start against a stronger engine", () => {
    expect([1, 2, 3].map((l) => reversi(l).level)).toEqual([1, 2, 3]);
    expect(fourUp(3).level).toBe(3);
  });
  it("Stack Fall starts at a higher level, with faster gravity", () => {
    const s = stack(rng(), 8);
    expect(s.level).toBe(8);
    expect(gravity(8)).toBeLessThan(gravity(1));
  });
  it("Flutter: smaller gaps on Hard", () => {
    expect(gapFor(0, 0)).toBeGreaterThan(gapFor(0, 1));
    expect(gapFor(0, 2)).toBeLessThan(gapFor(0, 1));
    expect(flutter(rng(), 2).pipes[0].gap).toBe(gapFor(0, 2));
  });
  it("Fruit Slice: more bombs on Hard", () => {
    expect(bombChance(10, 2)).toBeGreaterThan(bombChance(10, 1));
    expect(bombChance(10, 0)).toBeLessThan(bombChance(10, 1));
  });
  it("Brickline: wider paddle on Easy", () => {
    expect(paddleW(brick(rng(), 0, 0))).toBeGreaterThan(paddleW(brick(rng(), 0, 2)));
  });
  it("Puck and Rally: a sharper AI on Hard", () => {
    expect(puckAi(puck(2)).speed).toBeGreaterThan(puckAi(puck(0)).speed);
    expect(rallyAi(rally(rng(), 2)).error).toBeLessThan(rallyAi(rally(rng(), 0)).error);
  });
});
