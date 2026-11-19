import { describe, expect, it } from "vitest";
import { BASE, PERFECT, RANGE, drop, newGame, top, update } from "./logic";

const at = (pos: number) => {
  const s = newGame();
  s.pos = pos;
  return s;
};

describe("glide", () => {
  it("slider bounces between the range edges", () => {
    const s = newGame();
    for (let i = 0; i < 600; i++) {
      update(s, 1 / 60);
      expect(Math.abs(s.pos)).toBeLessThanOrEqual(RANGE);
    }
  });

  it("perfect drop snaps to the tower and keeps full size", () => {
    const s = at(PERFECT * 0.5);
    const r = drop(s);
    expect(r.kind).toBe("perfect");
    expect(top(s)).toEqual({ x: 0, z: 0, w: BASE, d: BASE });
    expect(s.combo).toBe(1);
  });

  it("cut keeps only the overlap and the piece is the exact overhang", () => {
    const s = at(1);
    const r = drop(s);
    if (r.kind !== "cut") throw new Error("expected cut");
    expect(r.placed.w).toBeCloseTo(BASE - 1);
    expect(r.placed.x).toBeCloseTo(0.5);
    expect(r.piece.w).toBeCloseTo(1);
    // Placed + piece exactly cover the slider's footprint [-0.5, 2.5].
    expect(r.placed.x - r.placed.w / 2).toBeCloseTo(-0.5);
    expect(r.piece.x + r.piece.w / 2).toBeCloseTo(2.5);
    expect(r.placed.x + r.placed.w / 2).toBeCloseTo(r.piece.x - r.piece.w / 2);
    expect(s.combo).toBe(0);
  });

  it("cut works on the negative side too", () => {
    const s = at(-1.2);
    const r = drop(s);
    if (r.kind !== "cut") throw new Error("expected cut");
    expect(r.piece.x + r.piece.w / 2).toBeCloseTo(-1.5);
    expect(r.piece.x - r.piece.w / 2).toBeCloseTo(-2.7);
  });

  it("missing entirely ends the game", () => {
    const s = at(BASE + 0.01);
    expect(drop(s).kind).toBe("miss");
    expect(s.over).toBe(true);
  });

  it("alternates axis and rewards a perfect streak by growing back", () => {
    const s = at(1); // shrink first
    drop(s);
    expect(s.axis).toBe("z");
    for (let i = 0; i < 5; i++) {
      s.pos = top(s)[s.axis];
      drop(s);
    }
    expect(top(s).w).toBeGreaterThan(BASE - 1);
    expect(top(s).w).toBeLessThanOrEqual(BASE);
  });

  it("survives a snapshot round-trip", () => {
    const s = at(0.4);
    drop(s);
    update(s, 0.3);
    const copy = JSON.parse(JSON.stringify(s));
    expect(drop(copy)).toEqual(drop(s));
  });
});
