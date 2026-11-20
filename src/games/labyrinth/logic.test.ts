import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { BALL_R, carve, exits, newGame, path, setTilt, sizeFor, step, type LabState } from "./logic";

const DT = 1 / 60;
/** Steer the ball along the BFS path by tilting toward the next cell centre. */
function autopilot(s: LabState) {
  const cx = Math.min(s.n - 1, Math.max(0, Math.floor(s.ball.x)));
  const cy = Math.min(s.n - 1, Math.max(0, Math.floor(s.ball.y)));
  const p = path(s, [cx, cy], [s.n - 1, s.n - 1]);
  const next = p[1] ?? p[0];
  const tx = next[0] + 0.5 - s.ball.x;
  const ty = next[1] + 0.5 - s.ball.y;
  // Brake: aim against current velocity a little so we don't overshoot corners.
  setTilt(s, tx * 3 - s.ball.vx * 0.35, ty * 3 - s.ball.vy * 0.35);
}

describe("labyrinth", () => {
  it("carves a perfect maze: every cell reachable, exactly n²−1 passages", () => {
    for (const n of [5, 8, 13]) {
      const m = { n, ...carve(n, createRng(n)) };
      let passages = 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) passages += exits(m, x, y).length;
      expect(passages / 2).toBe(n * n - 1);
      expect(path(m, [0, 0], [n - 1, n - 1])[0]).toEqual([0, 0]);
      for (let i = 0; i < 10; i++) {
        const c: [number, number] = [i % n, (i * 3) % n];
        const p = path(m, [0, 0], c);
        expect(p.at(-1)).toEqual(c);
      }
    }
  });

  it("holes sit in dead ends off the solution path", () => {
    const s = newGame(createRng(2));
    const sol = path(s, [0, 0], [s.n - 1, s.n - 1]).map((c) => c.join());
    for (const h of s.holes) {
      expect(exits(s, h[0], h[1])).toHaveLength(1);
      expect(sol).not.toContain(h.join());
    }
  });

  it("full tilt can't push the ball through a wall", () => {
    const rng = createRng(3);
    const s = newGame(rng);
    s.holes = [];
    for (const [tx, ty] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]) {
      setTilt(s, tx, ty);
      for (let i = 0; i < 120; i++) step(s, DT, rng);
      expect(s.ball.x).toBeGreaterThanOrEqual(BALL_R - 1e-6);
      expect(s.ball.y).toBeGreaterThanOrEqual(BALL_R - 1e-6);
      expect(s.ball.x).toBeLessThanOrEqual(s.n - BALL_R + 1e-6);
    }
    // Starting cell (0,0): if its east wall is closed the ball must still be in column 0.
    const t = newGame(createRng(4));
    t.holes = [];
    setTilt(t, 1, 0);
    for (let i = 0; i < 200; i++) step(t, DT, rng);
    if (t.right[0]) expect(t.ball.x).toBeLessThan(1);
  });

  it("tilt is clamped to a unit circle", () => {
    const s = newGame(createRng(5));
    setTilt(s, 3, 4);
    expect(Math.hypot(s.tilt.x, s.tilt.y)).toBeCloseTo(1);
  });

  it("an autopilot reaches the goal: score goes up and the next maze is bigger", () => {
    const rng = createRng(6);
    const s = newGame(rng);
    const n0 = s.n;
    let got = false;
    for (let i = 0; i < 60 * 120 && !got; i++) {
      autopilot(s);
      got = step(s, DT, rng).includes("goal");
    }
    expect(got).toBe(true);
    expect(s.level).toBe(1);
    expect(s.n).toBe(sizeFor(1));
    expect(s.n).toBeGreaterThan(n0);
    expect(s.score).toBeGreaterThan(0);
  });

  it("falling in a hole costs a life; losing the last ends the run", () => {
    const rng = createRng(7);
    const s = newGame(rng);
    s.holes = [[2, 2]];
    s.ball.x = 2.55;
    s.ball.y = 2.5;
    expect(step(s, DT, rng)).toContain("fall");
    expect(s.lives).toBe(2);
    for (let i = 0; i < 60; i++) step(s, DT, rng);
    expect(s.ball.x).toBe(0.5); // back at the start
    s.lives = 1;
    s.ball.x = 2.55;
    s.ball.y = 2.5;
    let dead = false;
    for (let i = 0; i < 70; i++) if (step(s, DT, rng).includes("dead")) dead = true;
    expect(dead).toBe(true);
    expect(s.alive).toBe(false);
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(8);
    const s = newGame(a);
    for (let i = 0; i < 300; i++) {
      autopilot(s);
      step(s, DT, a);
    }
    const copy: LabState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 900; i++) {
      autopilot(s);
      autopilot(copy);
      step(s, DT, a);
      step(copy, DT, b);
    }
    expect(copy).toEqual(s);
  });
});
