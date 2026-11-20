import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { BALL_R, H, LEVELS, PADDLE_Y, W, WIDE_W, brickRect, launch, levelBricks, movePaddle, newGame, step, type BrickState } from "./logic";

const DT = 1 / 60;
/** Autopilot: keep the paddle under the lowest falling ball. */
function track(s: BrickState) {
  const b = [...s.balls].sort((a, c) => c.y - a.y)[0];
  if (b) movePaddle(s, b.x + 3);
}

describe("brickline", () => {
  it("ball waits on the paddle and follows it until launch", () => {
    const rng = createRng(1);
    const s = newGame(rng);
    movePaddle(s, 20);
    step(s, 1, rng);
    expect(s.balls[0]).toMatchObject({ x: 20, y: PADDLE_Y - BALL_R });
    launch(s);
    step(s, DT, rng);
    expect(s.balls[0].y).toBeLessThan(PADDLE_Y - BALL_R);
  });

  it("paddle stays inside the walls", () => {
    const s = newGame(createRng(1));
    movePaddle(s, -50);
    expect(s.paddle).toBe(9);
    movePaddle(s, 500);
    expect(s.paddle).toBe(W - 9);
  });

  it("walls reflect the ball and it never leaves the sides or top, even at high speed (no tunnelling)", () => {
    const rng = createRng(2);
    const s = newGame(rng);
    s.bricks = [];
    s.stuck = false;
    s.speed = 400;
    s.balls = [{ x: 50, y: 80, vx: 300, vy: -260 }];
    for (let i = 0; i < 200; i++) {
      step(s, DT, rng);
      for (const b of s.balls) {
        expect(b.x).toBeGreaterThanOrEqual(BALL_R - 1e-9);
        expect(b.x).toBeLessThanOrEqual(W - BALL_R + 1e-9);
        expect(b.y).toBeGreaterThanOrEqual(BALL_R - 1e-9);
      }
      if (!s.balls.length || s.stuck) break;
    }
  });

  it("a fast ball can't pass through a thin brick", () => {
    const rng = createRng(3);
    const s = newGame(rng);
    s.bricks = [{ c: 5, r: 0, hp: 1 }, { c: 0, r: 8, hp: 3 }]; // second brick keeps the level going
    const r = brickRect(s.bricks[0]);
    s.stuck = false;
    s.speed = 100;
    s.balls = [{ x: r.x + r.w / 2, y: r.y + 30, vx: 0.0001, vy: -100 }];
    for (let i = 0; i < 40 && s.bricks.length > 1; i++) step(s, DT, rng);
    expect(s.bricks).toHaveLength(1);
    expect(s.balls[0].vy).toBeGreaterThan(0); // bounced back down
    expect(s.balls[0].y).toBeGreaterThan(r.y + r.h); // and never got past it
  });

  it("multi-hit bricks lose a point per hit and score", () => {
    const rng = createRng(4);
    const s = newGame(rng);
    s.bricks = [{ c: 5, r: 2, hp: 2 }, { c: 0, r: 0, hp: 1 }];
    const r = brickRect(s.bricks[0]);
    s.stuck = false;
    s.balls = [{ x: r.x + r.w / 2, y: r.y + 20, vx: 0.001, vy: -60 }];
    for (let i = 0; i < 60; i++) step(s, DT, rng);
    expect(s.bricks.find((b) => b.c === 5)?.hp).toBe(1);
    expect(s.score).toBe(10);
  });

  it("paddle hit angle depends on where the ball lands", () => {
    const rng = createRng(5);
    const mk = (offset: number) => {
      const s = newGame(rng);
      s.bricks = [{ c: 0, r: 0, hp: 1 }];
      s.stuck = false;
      s.balls = [{ x: s.paddle + offset, y: PADDLE_Y - 5, vx: 0, vy: 60 }];
      for (let i = 0; i < 20 && s.balls[0].vy > 0; i++) step(s, DT, rng);
      return s.balls[0].vx;
    };
    expect(mk(-7)).toBeLessThan(0);
    expect(mk(7)).toBeGreaterThan(0);
    expect(Math.abs(mk(0))).toBeLessThan(5);
  });

  it("losing every ball costs a life; the last one ends the game", () => {
    const rng = createRng(6);
    const s = newGame(rng);
    s.lives = 2;
    s.stuck = false;
    s.balls = [{ x: 2, y: H - 2, vx: 0, vy: 80 }];
    movePaddle(s, 90);
    let ev = step(s, 0.2, rng);
    expect(ev).toContain("lost");
    expect(s.lives).toBe(1);
    expect(s.stuck).toBe(true);
    s.stuck = false;
    s.balls = [{ x: 2, y: H - 2, vx: 0, vy: 80 }];
    ev = step(s, 0.2, rng);
    expect(ev).toContain("dead");
    expect(s.alive).toBe(false);
  });

  it("catching power-ups applies them", () => {
    const rng = createRng(7);
    const s = newGame(rng);
    launch(s);
    s.drops = [{ x: s.paddle, y: PADDLE_Y - 1, kind: "wide" }, { x: s.paddle, y: PADDLE_Y - 1, kind: "life" }];
    step(s, DT, rng);
    expect(s.wide).toBeGreaterThan(0);
    expect(s.lives).toBe(4);
    movePaddle(s, 0);
    expect(s.paddle).toBe(WIDE_W / 2);
    s.drops = [{ x: s.paddle, y: PADDLE_Y - 1, kind: "multi" }];
    step(s, DT, rng);
    expect(s.balls).toHaveLength(3);
  });

  it("clearing every brick advances to the next level", () => {
    const rng = createRng(8);
    const s = newGame(rng);
    s.bricks = [{ c: 5, r: 0, hp: 1 }];
    const r = brickRect(s.bricks[0]);
    s.stuck = false;
    s.balls = [{ x: r.x + r.w / 2, y: r.y + 10, vx: 0.001, vy: -60 }];
    let ev: string[] = [];
    for (let i = 0; i < 60 && !ev.includes("level"); i++) ev = step(s, DT, rng);
    expect(ev).toContain("level");
    expect(s.level).toBe(1);
    expect(s.bricks.length).toBeGreaterThan(0);
    expect(s.stuck).toBe(true);
  });

  it("levels: handmade ones parse, generated ones are symmetric and in bounds", () => {
    const rng = createRng(9);
    for (let l = 0; l < LEVELS.length; l++) expect(levelBricks(l, rng).length).toBeGreaterThan(10);
    const gen = levelBricks(12, rng);
    for (const b of gen) {
      expect(gen.some((o) => o.c === 9 - b.c && o.r === b.r && o.hp === b.hp)).toBe(true);
      expect(b.hp).toBeGreaterThanOrEqual(1);
      expect(b.hp).toBeLessThanOrEqual(3);
    }
  });

  it("an autopilot clears the first level", () => {
    const rng = createRng(10);
    const s = newGame(rng);
    launch(s);
    for (let i = 0; i < 60 * 600 && s.level === 0 && s.alive; i++) {
      track(s);
      step(s, DT, rng);
    }
    expect(s.level).toBe(1);
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(11);
    const s = newGame(a);
    launch(s);
    for (let i = 0; i < 300; i++) {
      track(s);
      step(s, DT, a);
    }
    const copy: BrickState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 600; i++) {
      track(s);
      track(copy);
      step(s, DT, a);
      step(copy, DT, b);
    }
    expect(copy).toEqual(s);
  });
});
