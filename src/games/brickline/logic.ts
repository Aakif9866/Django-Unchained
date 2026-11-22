/**
 * Brickline rules. Pure: no DOM, no clock. World is 100 × 150 units (portrait), y down.
 * Ball motion is sub-stepped so it never moves more than half its radius per step, which makes
 * circle-vs-box collision tunnel-free (a swept test without the algebra).
 */
import type { Rng } from "@/engine/rng";

export const W = 100;
export const H = 150;
export const COLS = 10;
export const BRICK_H = 5;
export const TOP = 18;
export const PADDLE_Y = 138;
export const PADDLE_H = 3;
export const BALL_R = 1.6;
export const BASE_W = 18;
export const WIDE_W = 28;
export const BASE_SPEED = 62;
export const MAX_SPEED = 105;
export const DROP_SPEED = 32;
export const EFFECT_S = 10;

export type Power = "wide" | "multi" | "slow" | "life";
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Brick {
  c: number;
  r: number;
  hp: number;
}
export interface Drop {
  x: number;
  y: number;
  kind: Power;
}
export interface BrickState {
  paddle: number; // centre x
  balls: Ball[];
  stuck: boolean; // ball rests on the paddle until launch
  speed: number;
  bricks: Brick[];
  drops: Drop[];
  wide: number; // seconds left
  slow: number;
  lives: number;
  score: number;
  level: number; // 0-based
  d?: number; // difficulty 0 Easy, 1 Medium, 2 Hard (missing = Medium)
  alive: boolean;
}
export type Event = "brick" | "break" | "paddle" | "wall" | "power" | "lost" | "level" | "dead";

/** Handmade levels: digit = hit points, "." = empty. After these, levels are generated. */
export const LEVELS = [
  ["1111111111", "1111111111", "2222222222", "2222222222", "1111111111"],
  ["..1111111.", ".122222221", "1233333321", ".122222221", "..1111111."],
  ["3.3.3.3.3.", ".2.2.2.2.2", "1.1.1.1.1.", ".1.1.1.1.1", "2.2.2.2.2.", ".3.3.3.3.3"],
  ["1........1", "21......12", "321....123", "2321..1232", "1232112321", "..123321.."],
  ["3333333333", "3........3", "3.222222.3", "3.2....2.3", "3.2.11.2.3", "3.222222.3", "3333333333"],
];

export const brickRect = (b: Brick) => ({ x: (b.c * W) / COLS, y: TOP + b.r * (BRICK_H + 1), w: W / COLS, h: BRICK_H });
const PAD = [4, 0, -4]; // paddle width by difficulty
export const paddleW = (s: BrickState) => (s.wide > 0 ? WIDE_W : BASE_W) + PAD[s.d ?? 1];

export function levelBricks(level: number, rng: Rng): Brick[] {
  const rows = LEVELS[level];
  const out: Brick[] = [];
  if (rows) {
    rows.forEach((row, r) => [...row].forEach((ch, c) => ch !== "." && out.push({ c, r, hp: Number(ch) })));
    return out;
  }
  // Generated: mirrored so it looks designed, denser and tougher as levels climb.
  const nRows = Math.min(9, 5 + Math.floor(level / 2));
  for (let r = 0; r < nRows; r++)
    for (let c = 0; c < COLS / 2; c++)
      if (rng.next() < 0.75) {
        const hp = 1 + Math.floor(rng.next() * Math.min(3, 1 + level / 3));
        out.push({ c, r, hp }, { c: COLS - 1 - c, r, hp });
      }
  return out.length ? out : [{ c: 4, r: 0, hp: 1 }];
}

export function newGame(rng: Rng, level = 0, d = 1): BrickState {
  return {
    paddle: W / 2, balls: [{ x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 }], stuck: true, speed: BASE_SPEED + level * 2,
    bricks: levelBricks(level, rng), drops: [], wide: 0, slow: 0, lives: 3, score: 0, level, alive: true, d,
  };
}

export function movePaddle(s: BrickState, x: number) {
  const half = paddleW(s) / 2;
  s.paddle = Math.max(half, Math.min(W - half, x));
  if (s.stuck) s.balls[0].x = s.paddle;
}

export function launch(s: BrickState) {
  if (!s.stuck || !s.alive) return;
  s.stuck = false;
  const a = -Math.PI / 2 + 0.25; // slightly right of vertical so it never loops straight up and down
  s.balls[0].vx = Math.cos(a) * s.speed;
  s.balls[0].vy = Math.sin(a) * s.speed;
}

const currentSpeed = (s: BrickState) => s.speed * (s.slow > 0 ? 0.7 : 1);

function setSpeed(b: Ball, v: number) {
  const m = Math.hypot(b.vx, b.vy) || 1;
  b.vx = (b.vx / m) * v;
  b.vy = (b.vy / m) * v;
  // Never let the ball go nearly horizontal: it would take forever to come back.
  if (Math.abs(b.vy) < v * 0.25) {
    b.vy = Math.sign(b.vy || -1) * v * 0.25;
    b.vx = Math.sign(b.vx || 1) * Math.sqrt(v * v - b.vy * b.vy);
  }
}

/** Circle vs rect: returns the push-out normal axis, or null when not touching. */
function hit(b: Ball, x: number, y: number, w: number, h: number): "x" | "y" | null {
  const nx = Math.max(x, Math.min(b.x, x + w));
  const ny = Math.max(y, Math.min(b.y, y + h));
  const dx = b.x - nx;
  const dy = b.y - ny;
  if (dx * dx + dy * dy >= BALL_R * BALL_R) return null;
  // Smaller penetration axis wins.
  const px = Math.min(Math.abs(b.x + BALL_R - x), Math.abs(x + w - (b.x - BALL_R)));
  const py = Math.min(Math.abs(b.y + BALL_R - y), Math.abs(y + h - (b.y - BALL_R)));
  return px < py ? "x" : "y";
}

const POWERS: Power[] = ["wide", "multi", "slow", "life"];

export function step(s: BrickState, dt: number, rng: Rng): Event[] {
  const ev: Event[] = [];
  if (!s.alive) return ev;
  s.wide = Math.max(0, s.wide - dt);
  s.slow = Math.max(0, s.slow - dt);
  movePaddle(s, s.paddle); // re-clamp if width changed

  // Power-up drops.
  const pw = paddleW(s);
  for (const d of s.drops) d.y += DROP_SPEED * dt;
  s.drops = s.drops.filter((d) => {
    if (d.y > PADDLE_Y - 2 && d.y < PADDLE_Y + PADDLE_H + 2 && Math.abs(d.x - s.paddle) < pw / 2 + 2) {
      ev.push("power");
      if (d.kind === "wide") s.wide = EFFECT_S;
      else if (d.kind === "slow") s.slow = EFFECT_S;
      else if (d.kind === "life") s.lives = Math.min(5, s.lives + 1);
      else if (d.kind === "multi" && !s.stuck) {
        const src = s.balls[0];
        for (const a of [-0.5, 0.5]) {
          const c = Math.cos(a);
          const sn = Math.sin(a);
          s.balls.push({ x: src.x, y: src.y, vx: src.vx * c - src.vy * sn, vy: src.vx * sn + src.vy * c });
        }
      }
      return false;
    }
    return d.y < H + 5;
  });

  if (s.stuck) return ev;
  const v = currentSpeed(s);
  for (const b of s.balls) setSpeed(b, v);
  const steps = Math.max(1, Math.ceil((v * dt) / (BALL_R * 0.5)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++)
    for (const b of s.balls) {
      b.x += b.vx * h;
      b.y += b.vy * h;
      if (b.x < BALL_R || b.x > W - BALL_R) {
        b.x = Math.max(BALL_R, Math.min(W - BALL_R, b.x));
        b.vx = b.x < W / 2 ? Math.abs(b.vx) : -Math.abs(b.vx);
        ev.push("wall");
      }
      if (b.y < BALL_R) {
        b.y = BALL_R;
        b.vy = Math.abs(b.vy);
        ev.push("wall");
      }
      // Paddle: angle depends on where it hits, like a curved surface.
      if (b.vy > 0 && hit(b, s.paddle - pw / 2, PADDLE_Y, pw, PADDLE_H)) {
        const off = Math.max(-1, Math.min(1, (b.x - s.paddle) / (pw / 2)));
        const a = -Math.PI / 2 + off * (Math.PI / 3);
        s.speed = Math.min(MAX_SPEED, s.speed + 0.6);
        b.vx = Math.cos(a) * v;
        b.vy = Math.sin(a) * v;
        b.y = PADDLE_Y - BALL_R;
        ev.push("paddle");
      }
      for (const br of s.bricks) {
        if (br.hp <= 0) continue;
        const r = brickRect(br);
        const axis = hit(b, r.x, r.y, r.w, r.h);
        if (!axis) continue;
        if (axis === "x") b.vx = b.x < r.x + r.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        else b.vy = b.y < r.y + r.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
        br.hp--;
        s.score += 10;
        if (br.hp === 0) {
          s.score += 40;
          ev.push("break");
          if (rng.next() < 0.14) s.drops.push({ x: r.x + r.w / 2, y: r.y + r.h, kind: rng.pick(POWERS) });
        } else ev.push("brick");
        break; // one brick per sub-step keeps corners from double-bouncing
      }
    }
  s.bricks = s.bricks.filter((br) => br.hp > 0);
  s.balls = s.balls.filter((b) => b.y < H + BALL_R);

  if (s.balls.length === 0) {
    s.lives--;
    s.drops = [];
    s.wide = 0;
    s.slow = 0;
    if (s.lives <= 0) {
      s.alive = false;
      ev.push("dead");
      return ev;
    }
    ev.push("lost");
    s.balls = [{ x: s.paddle, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 }];
    s.stuck = true;
  } else if (s.bricks.length === 0) {
    s.level++;
    s.score += 500;
    s.bricks = levelBricks(s.level, rng);
    s.balls = [{ x: s.paddle, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 }];
    s.stuck = true;
    s.drops = [];
    s.speed = BASE_SPEED + s.level * 2;
    ev.push("level");
  }
  return ev;
}
