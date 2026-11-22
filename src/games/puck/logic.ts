/**
 * Puck (air hockey) rules. Pure: no DOM, no clock. Top-down table 60 × 100, you defend y = 100, the AI y = 0.
 * Circle physics with restitution and light friction, sub-stepped. Mallets carry their own velocity into hits.
 * First to 7 wins the match; winning raises the AI level, losing ends the run.
 */
import type { Rng } from "@/engine/rng";

export const W = 60;
export const H = 100;
export const GOAL_W = 22;
export const PUCK_R = 3;
export const MALLET_R = 4.6;
export const MAX_PUCK = 170;
export const MALLET_SPEED = 260;
export const FRICTION = 0.72; // velocity kept per second
export const WALL_E = 0.88;
export const HIT_E = 0.92;
export const TO_WIN = 7;

export interface Disc {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface PuckState {
  puck: Disc;
  you: Disc;
  cpu: Disc;
  target: { x: number; y: number };
  pts: { you: number; cpu: number };
  level: number;
  d?: number; // difficulty 0 Easy, 1 Medium, 2 Hard (missing = Medium)
  pause: number; // after a goal
  score: number;
  alive: boolean;
}
export type Event = "hit" | "wall" | "goal-you" | "goal-cpu" | "match" | "dead";

/** Easy plays the AI a level softer, Hard 1.5 levels sharper. */
export const aiFor = (s: { level: number; d?: number }) => ai(s.level + [-1, 0, 1.5][s.d ?? 1]);
export const ai = (level: number) => ({ speed: 70 + level * 22, aimError: Math.max(2, 10 - level * 2.5), reach: 0.35 + level * 0.05 });

export function newGame(d = 1): PuckState {
  return {
    puck: { x: W / 2, y: H / 2 + 12, vx: 0, vy: 0 }, you: { x: W / 2, y: H - 12, vx: 0, vy: 0 }, cpu: { x: W / 2, y: 12, vx: 0, vy: 0 },
    target: { x: W / 2, y: H - 12 }, pts: { you: 0, cpu: 0 }, level: 0, pause: 0.6, score: 0, alive: true, d,
  };
}

export function aimYou(s: PuckState, x: number, y: number) {
  s.target = { x, y };
}

const clampHalf = (m: Disc, top: boolean) => {
  m.x = Math.max(MALLET_R, Math.min(W - MALLET_R, m.x));
  m.y = top ? Math.max(MALLET_R, Math.min(H / 2 - MALLET_R, m.y)) : Math.max(H / 2 + MALLET_R, Math.min(H - MALLET_R, m.y));
};

function moveMallet(m: Disc, tx: number, ty: number, maxSpeed: number, dt: number, top: boolean) {
  const dx = tx - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, maxSpeed * dt);
  const ox = m.x;
  const oy = m.y;
  if (d > 0) {
    m.x += (dx / d) * step;
    m.y += (dy / d) * step;
  }
  clampHalf(m, top);
  m.vx = dt > 0 ? (m.x - ox) / dt : 0;
  m.vy = dt > 0 ? (m.y - oy) / dt : 0;
}

/** Resolve puck vs mallet: push apart, reflect relative velocity, add the mallet's push. */
function collide(p: Disc, m: Disc): boolean {
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  const d = Math.hypot(dx, dy);
  const min = PUCK_R + MALLET_R;
  if (d >= min || d === 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  p.x = m.x + nx * min;
  p.y = m.y + ny * min;
  const rvx = p.vx - m.vx;
  const rvy = p.vy - m.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    p.vx -= (1 + HIT_E) * vn * nx;
    p.vy -= (1 + HIT_E) * vn * ny;
  }
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > MAX_PUCK) {
    p.vx *= MAX_PUCK / sp;
    p.vy *= MAX_PUCK / sp;
  }
  return true;
}

function cpuThink(s: PuckState, rng: Rng): { x: number; y: number } {
  const A = aiFor(s);
  const p = s.puck;
  // Strike when the puck is in our half and not racing away: get behind it, aim at the far goal.
  if (p.y < H * A.reach + 10 && p.y < H / 2) {
    const gx = W / 2 + (rng.next() * 2 - 1) * A.aimError;
    const dx = p.x - gx;
    const dy = p.y - H;
    const d = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / d) * (PUCK_R + MALLET_R - 2), y: p.y + (dy / d) * (PUCK_R + MALLET_R - 2) };
  }
  // Otherwise guard the goal mouth, shading toward the puck.
  return { x: W / 2 + (p.x - W / 2) * 0.55, y: 9 };
}

export function step(s: PuckState, dt: number, rng: Rng): Event[] {
  const ev: Event[] = [];
  if (!s.alive) return ev;
  if (s.pause > 0) {
    s.pause -= dt;
    moveMallet(s.you, s.target.x, s.target.y, MALLET_SPEED, dt, false);
    moveMallet(s.cpu, W / 2, 12, aiFor(s).speed, dt, true);
    return ev;
  }
  const n = 4;
  const h = dt / n;
  const t = cpuThink(s, rng);
  for (let i = 0; i < n; i++) {
    moveMallet(s.you, s.target.x, s.target.y, MALLET_SPEED, h, false);
    moveMallet(s.cpu, t.x, t.y, aiFor(s).speed, h, true);
    const p = s.puck;
    p.x += p.vx * h;
    p.y += p.vy * h;
    if (collide(p, s.you) || collide(p, s.cpu)) ev.push("hit");
    // Walls after mallets, so a mallet can never shove the puck through the rail.
    if (p.x < PUCK_R || p.x > W - PUCK_R) {
      p.x = Math.max(PUCK_R, Math.min(W - PUCK_R, p.x));
      p.vx = -p.vx * WALL_E;
      ev.push("wall");
    }
    const inMouth = Math.abs(p.x - W / 2) < GOAL_W / 2 - PUCK_R * 0.3;
    if (!inMouth && (p.y < PUCK_R || p.y > H - PUCK_R)) {
      p.y = Math.max(PUCK_R, Math.min(H - PUCK_R, p.y));
      p.vy = -p.vy * WALL_E;
      ev.push("wall");
    }
    if (p.y < -PUCK_R || p.y > H + PUCK_R) break;
  }
  const keep = FRICTION ** dt;
  s.puck.vx *= keep;
  s.puck.vy *= keep;

  const goal = s.puck.y < -PUCK_R ? "you" : s.puck.y > H + PUCK_R ? "cpu" : null;
  if (!goal) return ev;
  s.pts[goal]++;
  ev.push(goal === "you" ? "goal-you" : "goal-cpu");
  if (goal === "you") s.score += 100;
  // The conceding side gets the puck on its half.
  s.puck = { x: W / 2, y: goal === "you" ? H / 2 - 12 : H / 2 + 12, vx: 0, vy: 0 };
  s.pause = 0.8;
  if (s.pts[goal] >= TO_WIN) {
    if (goal === "you") {
      s.score += 1000;
      s.level++;
      s.pts = { you: 0, cpu: 0 };
      ev.push("match");
    } else {
      s.alive = false;
      ev.push("dead");
    }
  }
  return ev;
}
