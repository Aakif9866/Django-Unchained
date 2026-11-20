import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { H, LIVES, W, bombChance, newGame, slice, step, waveGap, type FruitState, type Item } from "./logic";

const DT = 1 / 60;
const fruit = (o: Partial<Item> = {}): Item => ({ id: 99, x: 50, y: 60, vx: 0, vy: 0, r: 8, kind: 0, a: 0, spin: 0, sliced: false, ...o });

describe("fruit slice", () => {
  it("tosses fruit that rises into view, peaks inside the screen, then falls", () => {
    const rng = createRng(1);
    const s = newGame();
    for (let i = 0; i < 60; i++) step(s, DT, rng);
    expect(s.items.length).toBeGreaterThan(0);
    const it = s.items[0];
    let minY = it.y;
    let maxX = it.x;
    let minX = it.x;
    for (let i = 0; i < 400 && s.items.includes(it); i++) {
      step(s, DT, rng);
      minY = Math.min(minY, it.y);
      maxX = Math.max(maxX, it.x);
      minX = Math.min(minX, it.x);
    }
    expect(minY).toBeLessThan(H - 40);
    expect(minY).toBeGreaterThan(0);
    expect(minX).toBeGreaterThan(0);
    expect(maxX).toBeLessThan(W);
  });

  it("a swipe through a fruit slices it and scores", () => {
    const s = newGame();
    s.items = [fruit()];
    const r = slice(s, 30, 60, 70, 60, 1);
    expect(r.cuts).toHaveLength(1);
    expect(s.score).toBe(1);
    expect(s.items[0].sliced).toBe(true);
  });

  it("a swipe that passes beside it doesn't", () => {
    const s = newGame();
    s.items = [fruit()];
    expect(slice(s, 30, 75, 70, 75, 1).cuts).toHaveLength(0);
  });

  it("slicing a bomb ends the run", () => {
    const s = newGame();
    s.items = [fruit({ kind: -1 })];
    expect(slice(s, 30, 60, 70, 60, 1).bomb).toBe(true);
    expect(s.alive).toBe(false);
  });

  it("missed fruit costs a life; missed bombs don't; out of lives ends the run", () => {
    const rng = createRng(2);
    const s = newGame();
    s.wave = 999;
    s.items = [fruit({ y: H + 20, vy: 10 }), fruit({ id: 2, kind: -1, y: H + 20, vy: 10 })];
    expect(step(s, DT, rng)).toContain("miss");
    expect(s.lives).toBe(LIVES - 1);
    expect(s.items).toHaveLength(0);
    s.lives = 1;
    s.items = [fruit({ y: H + 20, vy: 10 })];
    expect(step(s, DT, rng)).toContain("dead");
    expect(s.alive).toBe(false);
  });

  it("combo: the third fruit in one swipe adds a bonus, a new swipe resets it", () => {
    const s = newGame();
    s.items = [fruit({ id: 1, x: 20 }), fruit({ id: 2, x: 40 }), fruit({ id: 3, x: 60 }), fruit({ id: 4, x: 80 })];
    slice(s, 10, 60, 45, 60, 7); // two
    const r = slice(s, 45, 60, 90, 60, 7); // two more in the same swipe
    expect(r.bonus).toBe(1 + 2);
    expect(s.score).toBe(4 + 3);
    s.items = [fruit({ id: 5 })];
    expect(slice(s, 30, 60, 70, 60, 8).bonus).toBe(0);
  });

  it("gets busier over time", () => {
    expect(waveGap(120)).toBeLessThan(waveGap(0));
    expect(bombChance(120)).toBeGreaterThan(bombChance(0));
    expect(waveGap(9999)).toBe(0.85);
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(3);
    const s = newGame();
    for (let i = 0; i < 300; i++) step(s, DT, a);
    const copy: FruitState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 600; i++) {
      step(s, DT, a);
      step(copy, DT, b);
      if (i % 40 === 0) {
        slice(s, 0, 70, 100, 70, i);
        slice(copy, 0, 70, 100, 70, i);
      }
    }
    expect(copy).toEqual(s);
  });
});
