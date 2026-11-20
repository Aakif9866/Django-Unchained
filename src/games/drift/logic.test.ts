import { describe, expect, it } from "vitest";
import { BARRIER, LAPS, MAX_OFF, SAMPLES, TRACK, WIDTH, ghostAt, nearest, newGame, step, type DriftState } from "./logic";

const DT = 1 / 60;
/** Steer toward a point a few samples ahead on the centreline. */
function autopilot(s: DriftState, look = 9) {
  const [tx, ty] = TRACK[(s.seg + look) % SAMPLES];
  const want = Math.atan2(ty - s.car.y, tx - s.car.x);
  const diff = Math.atan2(Math.sin(want - s.car.h), Math.cos(want - s.car.h));
  s.steer = Math.max(-1, Math.min(1, diff * 2.5));
}

describe("drift", () => {
  it("the track is a smooth closed loop", () => {
    expect(TRACK).toHaveLength(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      const a = TRACK[i];
      const b = TRACK[(i + 1) % SAMPLES];
      const step = Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(step).toBeGreaterThan(0.3);
      expect(step).toBeLessThan(3);
    }
  });

  it("waits for the countdown, then accelerates by itself", () => {
    const s = newGame();
    for (let i = 0; i < 60; i++) step(s, DT);
    expect(Math.hypot(s.car.vx, s.car.vy)).toBe(0);
    for (let i = 0; i < 120; i++) step(s, DT);
    expect(Math.hypot(s.car.vx, s.car.vy)).toBeGreaterThan(20);
  });

  it("an autopilot completes the race, logs lap times, and records a ghost", () => {
    const s = newGame();
    const ev: string[] = [];
    for (let i = 0; i < 60 * 240 && !s.done; i++) {
      autopilot(s);
      ev.push(...step(s, DT));
    }
    expect(s.done).toBe(true);
    expect(s.laps).toHaveLength(LAPS);
    expect(ev.filter((e) => e === "lap")).toHaveLength(LAPS);
    expect(s.ghost!.length).toBeGreaterThan(30);
    expect(s.bestLap).toBe(Math.min(...s.laps));
    expect(s.score).toBeGreaterThan(100);
  });

  it("driving backwards never counts a lap", () => {
    const s = newGame();
    s.car.h += Math.PI;
    let laps = 0;
    for (let i = 0; i < 60 * 90; i++) {
      const [tx, ty] = TRACK[(s.seg - 9 + SAMPLES) % SAMPLES];
      const want = Math.atan2(ty - s.car.y, tx - s.car.x);
      s.steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(want - s.car.h), Math.cos(want - s.car.h)) * 2.5));
      laps += step(s, DT).filter((e) => e === "lap").length;
    }
    expect(laps).toBe(0);
  });

  it("grass slows you to its own top speed", () => {
    const s = newGame();
    s.countdown = 0;
    s.car.x += WIDTH * 1.2; // off to the side
    s.car.vx = Math.cos(s.car.h) * 40;
    s.car.vy = Math.sin(s.car.h) * 40;
    for (let i = 0; i < 60; i++) {
      s.steer = 0;
      step(s, DT);
      if (!s.offTrack) break;
    }
    if (s.offTrack) expect(Math.hypot(s.car.vx, s.car.vy)).toBeLessThan(40);
    expect(MAX_OFF).toBeLessThan(30);
  });

  it("the barrier keeps the car near the track", () => {
    const s = newGame();
    s.countdown = 0;
    s.steer = 1;
    for (let i = 0; i < 60 * 30; i++) {
      step(s, DT);
      expect(nearest(s.car.x, s.car.y).d).toBeLessThanOrEqual(WIDTH / 2 + BARRIER + 0.5);
    }
  });

  it("hard steering at speed makes the car slide", () => {
    const s = newGame();
    for (let i = 0; i < 60 * 4; i++) {
      autopilot(s);
      step(s, DT);
    }
    s.steer = 1;
    let drifted = false;
    for (let i = 0; i < 30; i++) {
      step(s, DT);
      if (s.drifting) drifted = true;
    }
    expect(drifted).toBe(true);
  });

  it("ghost interpolates between samples and ends with the lap", () => {
    const g = [0, 0, 0, 10, 0, 0, 20, 0, 0];
    expect(ghostAt(g, 0.05)!.x).toBeCloseTo(5);
    expect(ghostAt(g, 0.3)).toBeNull();
  });

  it("snapshot round-trip plays identically", () => {
    const s = newGame();
    for (let i = 0; i < 400; i++) {
      autopilot(s);
      step(s, DT);
    }
    const copy: DriftState = JSON.parse(JSON.stringify(s));
    for (let i = 0; i < 1200; i++) {
      autopilot(s);
      autopilot(copy);
      step(s, DT);
      step(copy, DT);
    }
    expect(copy).toEqual(s);
  });
});
