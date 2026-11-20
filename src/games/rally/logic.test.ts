import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { BALL_R, CPU_Y, H, PADDLE_W, SERVE_DELAY, TO_WIN, W, YOU_Y, ai, moveYou, newGame, predictX, step, type RallyState } from "./logic";

const DT = 1 / 60;
const live = (s: RallyState) => {
  s.serve = 0;
};

describe("rally", () => {
  it("predicts the crossing point through wall bounces", () => {
    expect(predictX(50, 100, 0, -50, 10)).toBeCloseTo(50);
    const x = predictX(50, 100, 50, -50, 10);
    expect(x).toBeGreaterThanOrEqual(BALL_R);
    expect(x).toBeLessThanOrEqual(W - BALL_R);
    // Simulate to check.
    let bx = 50;
    let vx = 50;
    for (let y = 100; y > 10; y -= 0.01) {
      bx += vx * (0.01 / 50);
      if (bx > W - BALL_R) {
        bx = 2 * (W - BALL_R) - bx;
        vx = -vx;
      }
      if (bx < BALL_R) {
        bx = 2 * BALL_R - bx;
        vx = -vx;
      }
    }
    expect(x).toBeCloseTo(bx, 0);
  });

  it("serve waits, then the ball heads to the receiver", () => {
    const rng = createRng(1);
    const s = newGame(rng);
    const y0 = s.ball.y;
    step(s, SERVE_DELAY / 2, rng);
    expect(s.ball.y).toBe(y0);
    for (let i = 0; i < 60; i++) step(s, DT, rng);
    expect(s.ball.y).toBeGreaterThan(y0); // first serve comes to you
  });

  it("your paddle returns the ball and the angle follows the hit point", () => {
    const rng = createRng(2);
    const s = newGame(rng);
    live(s);
    s.ball = { x: 60, y: YOU_Y - 6, vx: 0, vy: 60 };
    moveYou(s, 55); // ball lands right of centre
    const ev = step(s, 0.2, rng);
    expect(ev).toContain("hit");
    expect(s.ball.vy).toBeLessThan(0);
    expect(s.ball.vx).toBeGreaterThan(0);
  });

  it("missing gives the AI a point; the next serve goes to the point winner", () => {
    const rng = createRng(3);
    const s = newGame(rng);
    live(s);
    moveYou(s, 0);
    s.ball = { x: 90, y: H - 2, vx: 0, vy: 80 };
    const ev = step(s, 0.1, rng);
    expect(ev).toContain("point-cpu");
    expect(s.pts.cpu).toBe(1);
    expect(s.serve).toBeGreaterThan(0);
    expect(s.ball.vy).toBeLessThan(0); // heads to the AI, who won the point
  });

  it("AI paddle tracks a predictable ball and returns it", () => {
    const rng = createRng(4);
    const s = newGame(rng);
    live(s);
    s.ball = { x: 30, y: 80, vx: 20, vy: -60 };
    let hit = false;
    for (let i = 0; i < 120 && !hit; i++) hit = step(s, DT, rng).includes("hit");
    expect(hit).toBe(true);
    expect(s.ball.vy).toBeGreaterThan(0);
  });

  it("AI gets sharper each level", () => {
    expect(ai(3).reaction).toBeLessThan(ai(0).reaction);
    expect(ai(3).speed).toBeGreaterThan(ai(0).speed);
    expect(ai(3).error).toBeLessThan(ai(0).error);
  });

  it("winning a match by two levels up; losing one ends the run", () => {
    const rng = createRng(5);
    const s = newGame(rng);
    s.pts = { you: TO_WIN - 1, cpu: 3 };
    live(s);
    s.ball = { x: 50, y: 0, vx: 0, vy: -80 };
    s.cpu = 5; // nowhere near
    s.aiClock = 10;
    s.aiTarget = 5;
    expect(step(s, 0.1, rng)).toContain("match");
    expect(s.level).toBe(1);
    expect(s.pts).toEqual({ you: 0, cpu: 0 });
    s.pts = { you: 2, cpu: TO_WIN - 1 };
    live(s);
    moveYou(s, PADDLE_W / 2);
    s.ball = { x: 90, y: H - 1, vx: 0, vy: 80 };
    expect(step(s, 0.1, rng)).toContain("dead");
    expect(s.alive).toBe(false);
  });

  it("deuce: 7–6 isn't enough", () => {
    const rng = createRng(6);
    const s = newGame(rng);
    s.pts = { you: 6, cpu: 6 };
    live(s);
    s.ball = { x: 50, y: 0, vx: 0, vy: -80 };
    s.cpu = 5;
    s.aiClock = 10;
    s.aiTarget = 5;
    const ev = step(s, 0.1, rng);
    expect(ev).not.toContain("match");
    expect(s.pts.you).toBe(7);
  });

  it("ball stays inside the side walls", () => {
    const rng = createRng(7);
    const s = newGame(rng);
    for (let i = 0; i < 60 * 30 && s.alive; i++) {
      moveYou(s, s.ball.x);
      step(s, DT, rng);
      expect(s.ball.x).toBeGreaterThanOrEqual(BALL_R - 1e-9);
      expect(s.ball.x).toBeLessThanOrEqual(W - BALL_R + 1e-9);
    }
    expect(s.ball.y).toBeGreaterThan(CPU_Y - 20);
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(8);
    const s = newGame(a);
    for (let i = 0; i < 200; i++) {
      moveYou(s, s.ball.x + 3);
      step(s, DT, a);
    }
    const copy: RallyState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 900; i++) {
      moveYou(s, s.ball.x + 3);
      moveYou(copy, copy.ball.x + 3);
      step(s, DT, a);
      step(copy, DT, b);
    }
    expect(copy).toEqual(s);
  });
});
