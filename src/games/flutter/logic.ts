/** Flutter rules. Pure: no DOM, no clock. World is 100 units tall; x grows forever and the camera follows the bird. */
import type { Rng } from "@/engine/rng";

export interface Pipe {
  x: number; // left edge
  gapY: number; // gap centre
  gap: number; // gap height
  scored: boolean;
}
export interface FlutterState {
  d?: number; // difficulty 0 Easy, 1 Medium, 2 Hard (missing = Medium)
  x: number;
  y: number;
  vy: number;
  px: number; // previous x / y, for render interpolation
  py: number;
  pipes: Pipe[];
  score: number;
  started: boolean; // hovers until the first flap
  alive: boolean;
  t: number; // seconds alive, drives the idle bob
}
export type StepResult = "score" | "dead" | null;

export const H = 100;
export const R = 3.4; // bird radius
export const PIPE_W = 14;
export const SPACING = 58;
export const AHEAD = 240; // keep pipes generated this far past the bird (covers ultra-wide screens)
export const G = 260;
export const FLAP = -82;
export const MAX_FALL = 140;
const FIRST_PIPE = 90;

/** Scroll speed (units/s): ramps gently, caps so it stays playable one-handed. */
export const speed = (score: number) => 38 + Math.min(score, 30) * 0.5;
/** Gap height: generous at first, tightens to a floor. */
const GAP = [6, 0, -3];
export const gapFor = (score: number, d = 1) => Math.max(30 + GAP[d], 40 + GAP[d] - score * 0.3);

export function newGame(rng: Rng, d = 1): FlutterState {
  const s: FlutterState = { d, x: 0, y: H / 2, vy: 0, px: 0, py: H / 2, pipes: [], score: 0, started: false, alive: true, t: 0 };
  fill(s, rng);
  return s;
}

function fill(s: FlutterState, rng: Rng) {
  let last = s.pipes[s.pipes.length - 1];
  while (!last || last.x < s.x + AHEAD) {
    const n = s.score + s.pipes.filter((p) => !p.scored).length; // difficulty of this pipe when reached
    const gap = gapFor(n, s.d ?? 1);
    const lo = 14 + gap / 2;
    const hi = H - 14 - gap / 2;
    // Consecutive gaps never jump more than 30 units, so every sequence is reachable.
    const base = last ? last.gapY : H / 2;
    const gapY = Math.min(hi, Math.max(lo, base + (rng.next() * 2 - 1) * 30));
    last = { x: last ? last.x + SPACING : FIRST_PIPE, gapY, gap, scored: false };
    s.pipes.push(last);
  }
}

export function flap(s: FlutterState) {
  if (!s.alive) return;
  s.started = true;
  s.vy = FLAP;
}

/** Circle vs axis-aligned rectangle. */
function hits(cx: number, cy: number, x0: number, y0: number, x1: number, y1: number) {
  const nx = Math.max(x0, Math.min(cx, x1));
  const ny = Math.max(y0, Math.min(cy, y1));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < R * R;
}

export function collides(s: FlutterState): boolean {
  if (s.y + R >= H) return true;
  return s.pipes.some(
    (p) => hits(s.x, s.y, p.x, -1000, p.x + PIPE_W, p.gapY - p.gap / 2) || hits(s.x, s.y, p.x, p.gapY + p.gap / 2, p.x + PIPE_W, H + 1000),
  );
}

export function step(s: FlutterState, dt: number, rng: Rng): StepResult {
  s.px = s.x;
  s.py = s.y;
  if (!s.alive) return null;
  s.t += dt;
  if (!s.started) {
    s.y = H / 2 + Math.sin(s.t * 3) * 2; // idle hover
    return null;
  }
  s.vy = Math.min(MAX_FALL, s.vy + G * dt);
  s.y += s.vy * dt;
  s.x += speed(s.score) * dt;
  if (s.y < R) {
    s.y = R; // the ceiling is soft: bump, don't die
    s.vy = 0;
  }
  if (collides(s)) {
    s.alive = false;
    s.y = Math.min(s.y, H - R);
    return "dead";
  }
  let res: StepResult = null;
  for (const p of s.pipes)
    if (!p.scored && p.x + PIPE_W < s.x - R) {
      p.scored = true;
      s.score += 1;
      res = "score";
    }
  s.pipes = s.pipes.filter((p) => p.x + PIPE_W > s.x - 60);
  fill(s, rng);
  return res;
}
