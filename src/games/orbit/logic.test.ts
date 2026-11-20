import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { FIRE_EVERY, H, INVULN, MAX_SPEED, ROCK_POINTS, W, dist2, newGame, step, wd, wrap, type OrbitState } from "./logic";

const DT = 1 / 60;
const calm = (s: OrbitState) => {
  s.rocks = [];
  s.bullets = [];
};

describe("orbit", () => {
  it("wraps positions and measures distance across the seam", () => {
    expect(wrap(-1, 10)).toBe(9);
    expect(wrap(12, 10)).toBe(2);
    expect(wd(9, 10)).toBe(-1);
    expect(dist2({ x: 1, y: 1, vx: 0, vy: 0 }, { x: W - 1, y: H - 1, vx: 0, vy: 0 })).toBeCloseTo(8);
  });

  it("a new wave never spawns on top of the ship", () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = newGame(createRng(seed));
      for (const r of s.rocks) expect(Math.sqrt(dist2(s.ship, r))).toBeGreaterThan(30);
    }
  });

  it("turns toward the aim and thrusts that way, capped at max speed", () => {
    const rng = createRng(1);
    const s = newGame(rng);
    calm(s);
    s.rocks = [{ x: 0, y: 0, vx: 0, vy: 0, size: 1, seed: 1, spin: 0, a: 0 }]; // keep the wave going
    s.ctl = { aim: 0, turn: 0, thrust: 1 };
    for (let i = 0; i < 60 * 5; i++) {
      step(s, DT, rng);
      s.rocks[0].x = s.ship.x + 60; // never collide
      s.rocks[0].y = s.ship.y + 80;
    }
    expect(Math.cos(s.ship.a)).toBeCloseTo(1, 3);
    expect(Math.hypot(s.ship.vx, s.ship.vy)).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
    expect(s.ship.vx).toBeGreaterThan(30);
  });

  it("drag slows the ship when not thrusting", () => {
    const rng = createRng(2);
    const s = newGame(rng);
    s.ship.vx = 50;
    s.rocks = [{ x: 0, y: 0, vx: 0, vy: 0, size: 1, seed: 1, spin: 0, a: 0 }];
    for (let i = 0; i < 120; i++) {
      step(s, DT, rng);
      s.rocks[0].x = wrap(s.ship.x + 60, W);
    }
    expect(s.ship.vx).toBeLessThan(50 * 0.4);
  });

  it("fires automatically on a steady cadence", () => {
    const rng = createRng(3);
    const s = newGame(rng);
    s.fireCd = 0;
    let shots = 0;
    for (let i = 0; i < 60; i++) shots += step(s, DT, rng).filter((e) => e === "fire").length;
    expect(shots).toBe(Math.floor(1 / FIRE_EVERY) + 1);
  });

  it("a big rock splits into two mediums and scores; small rocks vanish", () => {
    const rng = createRng(4);
    const s = newGame(rng);
    calm(s);
    s.ship.a = 0;
    s.fireCd = 0;
    s.rocks = [{ x: s.ship.x + 20, y: s.ship.y, vx: 0, vy: 0, size: 3, seed: 1, spin: 0, a: 0 }];
    const ev: string[] = [];
    for (let i = 0; i < 20 && !ev.includes("split"); i++) ev.push(...step(s, DT, rng));
    expect(ev).toContain("split");
    expect(s.rocks.map((r) => r.size)).toEqual([2, 2]);
    expect(s.score).toBe(ROCK_POINTS[3]);
    s.rocks = [{ x: s.ship.x + 15, y: s.ship.y, vx: 0, vy: 0, size: 1, seed: 1, spin: 0, a: 0 }, { x: 0, y: 0, vx: 0, vy: 0, size: 3, seed: 2, spin: 0, a: 0 }];
    s.rocks[1].x = wrap(s.ship.x - 50, W);
    s.fireCd = 0;
    for (let i = 0; i < 20 && s.rocks.length > 1; i++) step(s, DT, rng);
    expect(s.rocks).toHaveLength(1);
  });

  it("crashing costs a life and respawns invulnerable; no lives left ends the game", () => {
    const rng = createRng(5);
    const s = newGame(rng);
    calm(s);
    s.ship.inv = 0;
    s.lives = 2;
    s.rocks = [{ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, size: 3, seed: 1, spin: 0, a: 0 }];
    expect(step(s, DT, rng)).toContain("crash");
    expect(s.lives).toBe(1);
    expect(s.ship.inv).toBe(INVULN);
    expect(step(s, DT, rng)).not.toContain("crash"); // still on the rock, but invulnerable
    s.ship.inv = 0;
    expect(step(s, DT, rng)).toContain("dead");
    expect(s.alive).toBe(false);
  });

  it("clearing every rock starts a bigger wave", () => {
    const rng = createRng(6);
    const s = newGame(rng);
    const first = s.rocks.length;
    s.rocks = [];
    expect(step(s, DT, rng)).toContain("wave");
    expect(s.wave).toBe(2);
    expect(s.rocks.length).toBe(first + 1);
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(7);
    const s = newGame(a);
    s.ctl = { aim: 1, turn: 0, thrust: 0.5 };
    for (let i = 0; i < 200; i++) step(s, DT, a);
    const copy: OrbitState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 600; i++) {
      const aim = (i / 100) % 6;
      s.ctl.aim = aim;
      copy.ctl.aim = aim;
      step(s, DT, a);
      step(copy, DT, b);
    }
    expect(copy).toEqual(s);
  });
});
