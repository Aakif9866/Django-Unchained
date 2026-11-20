import { describe, expect, it } from "vitest";
import { HOLES, MAX_STROKES, holePoints, newGame, segmentsOf, shoot, step, type GolfState } from "./logic";

const DT = 1 / 120;
const settle = (s: GolfState) => {
  const ev: string[] = [];
  for (let i = 0; i < 120 * 20 && (s.moving || s.sunk > 0); i++) ev.push(...step(s, DT));
  return ev;
};
const at = (hole: number): GolfState => {
  const s = newGame();
  s.hole = hole;
  [s.x, s.y] = HOLES[hole].tee;
  return s;
};
/** Inside polygon (ray casting). */
function inside(poly: [number, number][], x: number, y: number) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c;
  return c;
}

describe("pocket golf", () => {
  it("a straight putt on hole 1 rolls, slows and can sink", () => {
    const s = at(0);
    shoot(s, Math.PI / 2, 0.55);
    const ev = settle(s);
    expect(ev.includes("sink") || ev.includes("rest")).toBe(true);
    expect(s.y).toBeGreaterThan(10);
  });

  it("a too-fast ball skims over the cup", () => {
    const s = at(0);
    shoot(s, Math.PI / 2, 1);
    // First pass only: once it's beyond the cup it may bounce back and drop in, which is fine.
    for (let i = 0; i < 120 * 3 && s.moving && s.y < HOLES[0].cup[1] + 1.5; i++) step(s, DT);
    expect(s.sunk).toBe(0);
  });

  it("walls keep the ball on the course and bounce it", () => {
    for (let hole = 0; hole < HOLES.length; hole++) {
      const s = at(hole);
      shoot(s, 0.3 + hole, 1);
      for (let i = 0; i < 120 * 10 && s.moving; i++) {
        step(s, DT);
        expect(inside(HOLES[hole].boundary, s.x, s.y), `hole ${hole + 1} escaped at ${s.x},${s.y}`).toBe(true);
      }
    }
  });

  it("water costs a stroke and puts you back", () => {
    const s = at(5);
    shoot(s, Math.PI / 2 + 0.2, 0.7); // up-left into the pond
    const ev = settle(s);
    expect(ev).toContain("water");
    expect([s.x, s.y]).toEqual(HOLES[5].tee);
    expect(s.strokes).toBe(2);
  });

  it("slopes push the ball back down", () => {
    const s = at(3);
    s.y = 17;
    shoot(s, Math.PI / 2, 0.001);
    settle(s);
    expect(s.y).toBeLessThan(12.5);
  });

  it("sinking finishes the hole, scores by par, and moves to the next tee", () => {
    const s = at(0);
    s.x = 6;
    s.y = 25;
    shoot(s, Math.PI / 2, 0.08);
    settle(s);
    expect(s.cards).toEqual([1]);
    expect(s.score).toBe(holePoints(2, 1));
    expect(s.hole).toBe(1);
    expect([s.x, s.y]).toEqual(HOLES[1].tee);
  });

  it("after the max strokes you pick up", () => {
    const s = at(0);
    s.strokes = MAX_STROKES - 1;
    shoot(s, -Math.PI / 2, 0.1);
    const ev = settle(s);
    expect(ev).toContain("pickup");
    expect(s.hole).toBe(1);
  });

  it("every hole is closed and every hole can be sunk by a searching bot within par + 3", () => {
    for (let hole = 0; hole < HOLES.length; hole++) {
      const h = HOLES[hole];
      expect(inside(h.boundary, ...h.tee)).toBe(true);
      expect(inside(h.boundary, ...h.cup)).toBe(true);
      expect(segmentsOf(h).length).toBeGreaterThanOrEqual(h.boundary.length);
      const s = at(hole);
      let sunk = false;
      for (let stroke = 0; stroke < h.par + 3 && !sunk; stroke++) {
        let best: { a: number; p: number; d: number } | null = null;
        for (let ai = 0; ai < 48 && !sunk; ai++)
          for (const p of [0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 1]) {
            const t: GolfState = JSON.parse(JSON.stringify(s));
            shoot(t, (ai / 48) * Math.PI * 2, p);
            const ev = settle(t);
            const d = ev.includes("sink") ? -1 : ev.includes("water") ? 1e9 : Math.hypot(t.x - h.cup[0], t.y - h.cup[1]);
            if (!best || d < best.d) best = { a: (ai / 48) * Math.PI * 2, p, d };
          }
        shoot(s, best!.a, best!.p);
        sunk = settle(s).includes("sink");
      }
      expect(sunk, `hole ${hole + 1} not sunk`).toBe(true);
    }
  }, 60_000);

  it("finishing hole 9 ends the round", () => {
    const s = at(8);
    s.x = HOLES[8].cup[0];
    s.y = HOLES[8].cup[1] - 1;
    shoot(s, Math.PI / 2, 0.06);
    const ev = settle(s);
    expect(ev).toContain("done");
    expect(s.done).toBe(true);
  });

  it("snapshot round-trip plays identically", () => {
    const s = at(4);
    shoot(s, 1, 0.8);
    for (let i = 0; i < 60; i++) step(s, DT);
    const copy: GolfState = JSON.parse(JSON.stringify(s));
    for (let i = 0; i < 2000; i++) {
      step(s, DT);
      step(copy, DT);
    }
    expect(copy).toEqual(s);
  });
});
