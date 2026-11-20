/**
 * Rally rules. Pure: no DOM, no clock. Portrait court 100 × 150: you at the bottom, the AI at the top.
 * The AI only re-reads the ball every `reaction` seconds and aims with an error, so it's beatable and human-like.
 * First to 7 takes the match; winning a match makes the next AI sharper, losing one ends the run.
 */
import type { Rng } from "@/engine/rng";

export const W = 100;
export const H = 150;
export const PADDLE_W = 20;
export const PADDLE_H = 3;
export const YOU_Y = 138;
export const CPU_Y = 9;
export const BALL_R = 1.8;
export const START_SPEED = 62;
export const MAX_SPEED = 135;
export const TO_WIN = 7;
export const SERVE_DELAY = 0.9;

export interface RallyState {
  you: number; // paddle centre x
  cpu: number;
  ball: { x: number; y: number; vx: number; vy: number };
  serve: number; // countdown; ball frozen while > 0
  serveDir: 1 | -1; // +1 = toward you
  pts: { you: number; cpu: number };
  level: number;
  aiTarget: number;
  aiClock: number;
  score: number;
  alive: boolean;
}
export type Event = "hit" | "wall" | "point-you" | "point-cpu" | "match" | "dead";

export const ai = (level: number) => ({
  reaction: Math.max(0.05, 0.2 - level * 0.025),
  speed: 52 + level * 9,
  error: Math.max(1.5, 9 - level * 1.4),
});

export function newGame(rng: Rng): RallyState {
  const s: RallyState = {
    you: W / 2, cpu: W / 2, ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, serve: SERVE_DELAY, serveDir: 1,
    pts: { you: 0, cpu: 0 }, level: 0, aiTarget: W / 2, aiClock: 0, score: 0, alive: true,
  };
  resetBall(s, rng);
  return s;
}

function resetBall(s: RallyState, rng: Rng) {
  s.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  s.serve = SERVE_DELAY;
  const a = (rng.next() - 0.5) * 0.8;
  s.ball.vx = Math.sin(a) * START_SPEED;
  s.ball.vy = Math.cos(a) * START_SPEED * s.serveDir;
}

export function moveYou(s: RallyState, x: number) {
  s.you = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));
}

/** Where the ball will cross line y, folding wall bounces. */
export function predictX(x: number, y: number, vx: number, vy: number, lineY: number): number {
  if (vy === 0 || Math.sign(lineY - y) !== Math.sign(vy)) return x;
  const t = (lineY - y) / vy;
  const lo = BALL_R;
  const span = W - 2 * BALL_R;
  let p = (x + vx * t - lo) % (2 * span);
  if (p < 0) p += 2 * span;
  return lo + (p > span ? 2 * span - p : p);
}

function paddleHit(s: RallyState, px: number, dir: 1 | -1) {
  const b = s.ball;
  const off = Math.max(-1, Math.min(1, (b.x - px) / (PADDLE_W / 2)));
  const sp = Math.min(MAX_SPEED, Math.hypot(b.vx, b.vy) + 4);
  const a = off * (Math.PI / 3.2);
  b.vx = Math.sin(a) * sp;
  b.vy = Math.cos(a) * sp * dir;
}

export function step(s: RallyState, dt: number, rng: Rng): Event[] {
  const ev: Event[] = [];
  if (!s.alive) return ev;
  const A = ai(s.level);

  // AI: re-read the ball on its reaction clock, then glide toward the target.
  s.aiClock -= dt;
  if (s.aiClock <= 0) {
    s.aiClock = A.reaction;
    const b = s.ball;
    s.aiTarget =
      b.vy < 0 && s.serve <= 0
        ? predictX(b.x, b.y, b.vx, b.vy, CPU_Y + PADDLE_H) + (rng.next() * 2 - 1) * A.error
        : W / 2 + (b.x - W / 2) * 0.3;
  }
  const d = s.aiTarget - s.cpu;
  s.cpu += Math.sign(d) * Math.min(Math.abs(d), A.speed * dt);
  s.cpu = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, s.cpu));

  if (s.serve > 0) {
    s.serve -= dt;
    return ev;
  }
  const b = s.ball;
  const n = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / BALL_R));
  for (let i = 0; i < n; i++) {
    b.x += (b.vx * dt) / n;
    b.y += (b.vy * dt) / n;
    if (b.x < BALL_R || b.x > W - BALL_R) {
      b.x = Math.max(BALL_R, Math.min(W - BALL_R, b.x));
      b.vx = -b.vx;
      ev.push("wall");
    }
    if (b.vy > 0 && b.y + BALL_R >= YOU_Y && b.y - BALL_R <= YOU_Y + PADDLE_H && Math.abs(b.x - s.you) <= PADDLE_W / 2 + BALL_R) {
      b.y = YOU_Y - BALL_R;
      paddleHit(s, s.you, -1);
      s.score += 5;
      ev.push("hit");
    }
    if (b.vy < 0 && b.y - BALL_R <= CPU_Y + PADDLE_H && b.y + BALL_R >= CPU_Y && Math.abs(b.x - s.cpu) <= PADDLE_W / 2 + BALL_R) {
      b.y = CPU_Y + PADDLE_H + BALL_R;
      paddleHit(s, s.cpu, 1);
      ev.push("hit");
    }
  }

  const point = b.y > H + BALL_R ? "cpu" : b.y < -BALL_R ? "you" : null;
  if (!point) return ev;
  s.pts[point]++;
  ev.push(point === "you" ? "point-you" : "point-cpu");
  if (point === "you") s.score += 100;
  s.serveDir = point === "you" ? 1 : -1; // the point winner receives the next serve
  const { you, cpu } = s.pts;
  if (Math.max(you, cpu) >= TO_WIN && Math.abs(you - cpu) >= 2) {
    if (you > cpu) {
      s.score += 1000;
      s.level++;
      s.pts = { you: 0, cpu: 0 };
      ev.push("match");
    } else {
      s.alive = false;
      ev.push("dead");
      return ev;
    }
  }
  resetBall(s, rng);
  return ev;
}
