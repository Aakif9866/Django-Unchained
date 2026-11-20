import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import {
  COLS, DEAD_ROW, MISSES_PER_ROW, R, W, center, fire, key, neighbors, newGame, place, rowLen, setAim, step, swap, type BubbleState,
} from "./logic";

const DT = 1 / 60;
function empty(): BubbleState {
  const s = newGame(createRng(1));
  s.grid = {};
  return s;
}

describe("bubble", () => {
  it("offset rows: odd rows are shifted and one shorter; neighbours are the 6 touching cells", () => {
    const s = empty();
    expect(rowLen(s, 0)).toBe(COLS);
    expect(rowLen(s, 1)).toBe(COLS - 1);
    expect(center(s, 1, 0).x - center(s, 0, 0).x).toBeCloseTo(R);
    for (const [r, c] of neighbors(s, 2, 4)) {
      const a = center(s, 2, 4);
      const b = center(s, r, c);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(2 * R, 5);
    }
    expect(neighbors(s, 2, 4)).toHaveLength(6);
    expect(neighbors(s, 0, 0)).toHaveLength(2); // corner
  });

  it("three of a colour pop; two don't", () => {
    const rng = createRng(2);
    const s = empty();
    s.grid[key(0, 0)] = 1;
    s.grid[key(0, 5)] = 2;
    let res = place(s, 0, 1, 1, rng);
    expect(res.popped).toHaveLength(0);
    res = place(s, 0, 2, 1, rng);
    expect(res.popped).toHaveLength(3);
    expect(s.grid[key(0, 0)]).toBeUndefined();
    expect(s.score).toBe(30);
  });

  it("bubbles left hanging from nothing fall and score extra", () => {
    const rng = createRng(3);
    const s = empty();
    s.grid[key(0, 4)] = 1;
    s.grid[key(0, 5)] = 1;
    s.grid[key(1, 4)] = 2; // hangs from (0,4)/(0,5)
    s.grid[key(2, 4)] = 3;
    s.grid[key(0, 0)] = 4; // keeps the board non-empty
    const res = place(s, 0, 3, 1, rng);
    expect(res.popped).toHaveLength(3);
    expect(res.dropped.map((d) => d.color).sort()).toEqual([2, 3]);
    expect(Object.keys(s.grid)).toEqual([key(0, 0)]);
  });

  it("a shot bounces off the side wall and sticks to the ceiling", () => {
    const rng = createRng(4);
    const s = empty();
    s.grid[key(0, 9)] = 0; // non-empty board
    s.grid[key(0, 8)] = 1;
    setAim(s, -Math.PI + 0.5); // up-left
    fire(s);
    let landed = null;
    let bounced = false;
    for (let i = 0; i < 300 && !landed; i++) {
      landed = step(s, DT, rng);
      if (s.shot && s.shot.vx > 0) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(landed).not.toBeNull();
    expect(Object.keys(s.grid).some((k) => k.startsWith("0,") && !["0,9", "0,8"].includes(k))).toBe(true);
  });

  it("aim is clamped so you can't shoot sideways or down", () => {
    const s = empty();
    setAim(s, 0.5);
    expect(s.aim).toBeLessThan(0);
    setAim(s, -4);
    expect(s.aim).toBeGreaterThan(-Math.PI);
  });

  it("misses push a new row down from the top, keeping bubble offsets", () => {
    const rng = createRng(5);
    const s = empty();
    s.grid[key(0, 0)] = 0;
    s.grid[key(1, 0)] = 1;
    const before = center(s, 1, 0).x;
    let pushed = false;
    for (let i = 0; i < MISSES_PER_ROW; i++) pushed = place(s, 5, 2 * i, 2 + (i % 2), rng).pushed;
    expect(pushed).toBe(true);
    expect(s.grid[key(2, 0)]).toBe(1);
    expect(center(s, 2, 0).x).toBeCloseTo(before);
    for (let c = 0; c < rowLen(s, 0); c++) expect(s.grid[key(0, c)]).toBeDefined();
  });

  it("game over when the stack reaches the dead row", () => {
    const rng = createRng(6);
    const s = empty();
    s.grid[key(0, 0)] = 0;
    place(s, DEAD_ROW, 2, 3, rng);
    expect(s.alive).toBe(false);
    expect(fire(s)).toBe(false);
  });

  it("clearing the board scores a bonus and deals a new one", () => {
    const rng = createRng(7);
    const s = empty();
    s.grid[key(0, 0)] = 1;
    s.grid[key(0, 1)] = 1;
    const res = place(s, 0, 2, 1, rng);
    expect(res.cleared).toBe(true);
    expect(s.level).toBe(1);
    expect(Object.keys(s.grid).length).toBeGreaterThan(20);
  });

  it("next shots only use colours that are on the board; swap trades them", () => {
    const rng = createRng(8);
    const s = newGame(rng);
    const colors = new Set(Object.values(s.grid));
    expect(colors.has(s.cur)).toBe(true);
    expect(colors.has(s.next)).toBe(true);
    const [a, b] = [s.cur, s.next];
    swap(s);
    expect([s.cur, s.next]).toEqual([b, a]);
  });

  it("a fired shot always lands somewhere inside the grid", () => {
    const rng = createRng(9);
    const s = newGame(rng);
    for (let n = 0; n < 30 && s.alive; n++) {
      setAim(s, -Math.PI / 2 + Math.sin(n) * 1.2);
      fire(s);
      for (let i = 0; i < 600 && s.shot; i++) step(s, DT, rng);
      expect(s.shot).toBeNull();
      for (const k of Object.keys(s.grid)) {
        const [r, c] = k.split(",").map(Number);
        expect(c).toBeLessThan(rowLen(s, r));
        expect(center(s, r, c).x).toBeLessThanOrEqual(W);
      }
    }
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(10);
    const s = newGame(a);
    const play = (st: BubbleState, r: ReturnType<typeof createRng>, n: number) => {
      setAim(st, -Math.PI / 2 + Math.sin(n) * 1.1);
      fire(st);
      for (let i = 0; i < 600 && st.shot; i++) step(st, DT, r);
    };
    for (let n = 0; n < 5; n++) play(s, a, n);
    const copy: BubbleState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let n = 5; n < 20; n++) {
      play(s, a, n);
      play(copy, b, n);
    }
    expect(copy).toEqual(s);
  });
});
