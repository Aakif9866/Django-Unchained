import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { H, MALLET_R, MAX_PUCK, PUCK_R, TO_WIN, W, ai, aimYou, newGame, step, type PuckState } from "./logic";

const DT = 1 / 60;
const live = (s: PuckState) => {
  s.pause = 0;
};

describe("puck", () => {
  it("your mallet chases the finger but stays in your half", () => {
    const rng = createRng(1);
    const s = newGame();
    aimYou(s, 5, 10); // in the AI half
    for (let i = 0; i < 120; i++) step(s, DT, rng);
    expect(s.you.y).toBeGreaterThanOrEqual(H / 2 + MALLET_R);
    expect(s.you.x).toBeCloseTo(5, 1);
  });

  it("walls bounce the puck back with some energy lost", () => {
    const rng = createRng(2);
    const s = newGame();
    live(s);
    s.cpu.x = 50;
    s.puck = { x: 5, y: 40, vx: -80, vy: 0 };
    step(s, 0.1, rng);
    expect(s.puck.vx).toBeGreaterThan(0);
    expect(s.puck.vx).toBeLessThan(80);
  });

  it("a moving mallet hits the puck away and caps its speed", () => {
    const rng = createRng(3);
    const s = newGame();
    live(s);
    s.puck = { x: 30, y: 70, vx: 0, vy: 0 };
    s.you = { x: 30, y: 80, vx: 0, vy: 0 };
    aimYou(s, 30, 55);
    const ev: string[] = [];
    for (let i = 0; i < 10; i++) ev.push(...step(s, DT, rng));
    expect(ev).toContain("hit");
    expect(s.puck.vy).toBeLessThan(-50);
    expect(Math.hypot(s.puck.vx, s.puck.vy)).toBeLessThanOrEqual(MAX_PUCK);
    expect(Math.hypot(s.puck.x - s.you.x, s.puck.y - s.you.y)).toBeGreaterThanOrEqual(PUCK_R + MALLET_R - 1e-6);
  });

  it("puck into the AI goal scores for you, and they get the restart", () => {
    const rng = createRng(4);
    const s = newGame();
    live(s);
    s.cpu.x = 5; // out of the way
    s.puck = { x: W / 2, y: 6, vx: 0, vy: -120 };
    const ev = step(s, 0.1, rng);
    expect(ev).toContain("goal-you");
    expect(s.pts.you).toBe(1);
    expect(s.puck.y).toBeLessThan(H / 2);
    expect(s.score).toBe(100);
  });

  it("outside the goal mouth the end wall bounces", () => {
    const rng = createRng(5);
    const s = newGame();
    live(s);
    s.cpu.x = 50;
    s.cpu.y = 20;
    s.puck = { x: 6, y: 6, vx: 0, vy: -100 };
    const ev = step(s, 0.1, rng);
    expect(ev).not.toContain("goal-you");
    expect(s.puck.vy).toBeGreaterThan(0);
  });

  it("the AI blocks a slow shot straight at its goal", () => {
    const rng = createRng(6);
    const s = newGame();
    live(s);
    s.puck = { x: W / 2, y: 60, vx: 0, vy: -45 };
    let conceded = false;
    for (let i = 0; i < 180; i++) if (step(s, DT, rng).includes("goal-you")) conceded = true;
    expect(conceded).toBe(false);
  });

  it("match: first to 7 levels up the AI; conceding the 7th ends the run", () => {
    const rng = createRng(7);
    const s = newGame();
    live(s);
    s.pts.you = TO_WIN - 1;
    s.cpu.x = 5;
    s.puck = { x: W / 2, y: 6, vx: 0, vy: -120 };
    expect(step(s, 0.1, rng)).toContain("match");
    expect(s.level).toBe(1);
    expect(ai(1).speed).toBeGreaterThan(ai(0).speed);
    live(s);
    s.pts.cpu = TO_WIN - 1;
    s.you.x = 5;
    s.target = { x: 5, y: H - 10 };
    s.puck = { x: W / 2, y: H - 6, vx: 0, vy: 120 };
    expect(step(s, 0.1, rng)).toContain("dead");
    expect(s.alive).toBe(false);
  });

  it("puck never escapes the table sides", () => {
    const rng = createRng(8);
    const s = newGame();
    for (let i = 0; i < 60 * 30 && s.alive; i++) {
      aimYou(s, s.puck.x, Math.max(H / 2, s.puck.y + 4));
      step(s, DT, rng);
      expect(s.puck.x).toBeGreaterThanOrEqual(PUCK_R - 1e-9);
      expect(s.puck.x).toBeLessThanOrEqual(W - PUCK_R + 1e-9);
    }
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(9);
    const s = newGame();
    const drive = (st: PuckState) => aimYou(st, st.puck.x, Math.max(H / 2, st.puck.y + 4));
    for (let i = 0; i < 200; i++) {
      drive(s);
      step(s, DT, a);
    }
    const copy: PuckState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 900; i++) {
      drive(s);
      drive(copy);
      step(s, DT, a);
      step(copy, DT, b);
    }
    expect(copy).toEqual(s);
  });
});
