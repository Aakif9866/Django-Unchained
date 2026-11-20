import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { AHEAD, FLAP, H, PIPE_W, R, SPACING, flap, gapFor, newGame, speed, step, type FlutterState } from "./logic";

const DT = 1 / 60;
/** A bot that flaps whenever it sinks below the next gap's centre. */
function autopilot(s: FlutterState) {
  const next = s.pipes.find((p) => p.x + PIPE_W > s.x - R)!;
  if (s.y > next.gapY + 4 && s.vy > 0) flap(s);
}

describe("flutter", () => {
  it("hovers in place until the first flap", () => {
    const rng = createRng(1);
    const s = newGame(rng);
    for (let i = 0; i < 120; i++) step(s, DT, rng);
    expect(s.x).toBe(0);
    expect(s.alive).toBe(true);
    expect(Math.abs(s.y - H / 2)).toBeLessThanOrEqual(2);
  });

  it("flap sets upward velocity, gravity pulls it back", () => {
    const rng = createRng(1);
    const s = newGame(rng);
    flap(s);
    expect(s.vy).toBe(FLAP);
    step(s, DT, rng);
    expect(s.y).toBeLessThan(H / 2);
    for (let i = 0; i < 30; i++) step(s, DT, rng);
    expect(s.vy).toBeGreaterThan(0);
  });

  it("dies on the ground", () => {
    const rng = createRng(2);
    const s = newGame(rng);
    flap(s);
    let r = null;
    for (let i = 0; i < 600 && r !== "dead"; i++) r = step(s, DT, rng);
    expect(r).toBe("dead");
    expect(s.alive).toBe(false);
    expect(step(s, DT, rng)).toBeNull();
  });

  it("the ceiling bumps instead of killing", () => {
    const rng = createRng(3);
    const s = newGame(rng);
    s.pipes = []; // open sky for this check
    for (let i = 0; i < 40; i++) {
      flap(s);
      s.pipes = [];
      s.x = -1000; // keep pipes far away
      step(s, DT, rng);
    }
    expect(s.alive).toBe(true);
    expect(s.y).toBeGreaterThanOrEqual(R);
  });

  it("hits a pipe it flies into", () => {
    const rng = createRng(4);
    const s = newGame(rng);
    const p = s.pipes[0];
    s.started = true;
    s.x = p.x + PIPE_W / 2;
    s.y = p.gapY - p.gap / 2 - 5; // inside the top pipe
    s.vy = 0;
    expect(step(s, DT, rng)).toBe("dead");
  });

  it("keeps pipes generated ahead, evenly spaced, with reachable gaps inside the world", () => {
    const rng = createRng(5);
    const s = newGame(rng);
    flap(s);
    for (let i = 0; i < 4000 && s.alive; i++) {
      autopilot(s);
      step(s, DT, rng);
    }
    const last = s.pipes[s.pipes.length - 1];
    expect(last.x).toBeGreaterThanOrEqual(s.x + AHEAD);
    for (let i = 1; i < s.pipes.length; i++) {
      const a = s.pipes[i - 1];
      const b = s.pipes[i];
      expect(b.x - a.x).toBeCloseTo(SPACING);
      expect(Math.abs(b.gapY - a.gapY)).toBeLessThanOrEqual(30);
      expect(b.gapY - b.gap / 2).toBeGreaterThanOrEqual(14);
      expect(b.gapY + b.gap / 2).toBeLessThanOrEqual(H - 14);
    }
  });

  it("is beatable: a simple autopilot scores and score counts each pipe once", () => {
    const rng = createRng(6);
    const s = newGame(rng);
    flap(s);
    let scored = 0;
    for (let i = 0; i < 60 * 60 && s.alive; i++) {
      autopilot(s);
      if (step(s, DT, rng) === "score") scored++;
    }
    expect(s.score).toBeGreaterThanOrEqual(10);
    expect(scored).toBe(s.score);
  });

  it("difficulty ramps and caps", () => {
    expect(speed(0)).toBeLessThan(speed(10));
    expect(speed(30)).toBe(speed(500));
    expect(gapFor(0)).toBeGreaterThan(gapFor(20));
    expect(gapFor(500)).toBe(30);
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(9);
    const s = newGame(a);
    flap(s);
    for (let i = 0; i < 90; i++) {
      autopilot(s);
      step(s, DT, a);
    }
    const copy: FlutterState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 600; i++) {
      autopilot(s);
      autopilot(copy);
      step(s, DT, a);
      step(copy, DT, b);
    }
    expect(copy).toEqual(s);
  });
});
