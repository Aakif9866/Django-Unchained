/**
 * Labyrinth rules. Pure: no DOM, no clock. A perfect maze (depth-first carve) of n×n unit cells.
 * Tilt accelerates the ball; walls are segments (circle-vs-segment, sub-stepped). Holes sit in dead ends:
 * fall in and you lose a life and restart the level. Reach the goal to go to a bigger maze.
 */
import type { Rng } from "@/engine/rng";

export const BALL_R = 0.26;
export const HOLE_R = 0.3;
export const ACCEL = 16;
export const DAMP = 0.55; // velocity kept per second
export const WALL_E = 0.35;
export const LIVES = 3;

export interface LabState {
  level: number;
  n: number;
  right: boolean[]; // wall on the east side of cell i (n*n)
  down: boolean[]; // wall on the south side of cell i
  holes: [number, number][]; // cell coords
  ball: { x: number; y: number; vx: number; vy: number };
  tilt: { x: number; y: number }; // -1..1
  t: number;
  lives: number;
  falling: number;
  score: number;
  alive: boolean;
}
export type Event = "goal" | "fall" | "dead" | "bump";

export const sizeFor = (level: number) => Math.min(13, 5 + level);
const idx = (n: number, x: number, y: number) => y * n + x;

export function carve(n: number, rng: Rng): { right: boolean[]; down: boolean[] } {
  const right = Array(n * n).fill(true);
  const down = Array(n * n).fill(true);
  const seen = Array(n * n).fill(false);
  const stack: [number, number][] = [[0, 0]];
  seen[0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dx, dy]) => [x + dx, y + dy] as const)
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[idx(n, nx, ny)]);
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const [nx, ny] = opts[Math.floor(rng.next() * opts.length)];
    if (nx > x) right[idx(n, x, y)] = false;
    else if (nx < x) right[idx(n, nx, ny)] = false;
    else if (ny > y) down[idx(n, x, y)] = false;
    else down[idx(n, nx, ny)] = false;
    seen[idx(n, nx, ny)] = true;
    stack.push([nx, ny]);
  }
  return { right, down };
}

/** Open neighbours of a cell. */
export function exits(s: Pick<LabState, "n" | "right" | "down">, x: number, y: number): [number, number][] {
  const { n } = s;
  const out: [number, number][] = [];
  if (x < n - 1 && !s.right[idx(n, x, y)]) out.push([x + 1, y]);
  if (x > 0 && !s.right[idx(n, x - 1, y)]) out.push([x - 1, y]);
  if (y < n - 1 && !s.down[idx(n, x, y)]) out.push([x, y + 1]);
  if (y > 0 && !s.down[idx(n, x, y - 1)]) out.push([x, y - 1]);
  return out;
}

/** BFS path of cells from a to b. */
export function path(s: Pick<LabState, "n" | "right" | "down">, a: [number, number], b: [number, number]): [number, number][] {
  const prev = new Map<number, number>();
  const q = [a];
  const key = (c: [number, number]) => idx(s.n, c[0], c[1]);
  prev.set(key(a), -1);
  while (q.length) {
    const c = q.shift()!;
    if (c[0] === b[0] && c[1] === b[1]) break;
    for (const nb of exits(s, c[0], c[1]))
      if (!prev.has(key(nb))) {
        prev.set(key(nb), key(c));
        q.push(nb);
      }
  }
  const out: [number, number][] = [];
  for (let k = key(b); k !== -1 && k !== undefined; k = prev.get(k)!) out.unshift([k % s.n, Math.floor(k / s.n)]);
  return out;
}

export function segments(s: Pick<LabState, "n" | "right" | "down">): [number, number, number, number][] {
  const { n } = s;
  const segs: [number, number, number, number][] = [[0, 0, n, 0], [0, 0, 0, n], [n, 0, n, n], [0, n, n, n]];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (x < n - 1 && s.right[idx(n, x, y)]) segs.push([x + 1, y, x + 1, y + 1]);
      if (y < n - 1 && s.down[idx(n, x, y)]) segs.push([x, y + 1, x + 1, y + 1]);
    }
  return segs;
}

function setup(s: LabState, rng: Rng) {
  s.n = sizeFor(s.level);
  const { right, down } = carve(s.n, rng);
  s.right = right;
  s.down = down;
  // Holes go in dead ends that are off the solution path, so the shortest route is always safe.
  const sol = new Set(path(s, [0, 0], [s.n - 1, s.n - 1]).map(([x, y]) => idx(s.n, x, y)));
  const dead: [number, number][] = [];
  for (let y = 0; y < s.n; y++)
    for (let x = 0; x < s.n; x++) if (exits(s, x, y).length === 1 && !sol.has(idx(s.n, x, y))) dead.push([x, y]);
  s.holes = [];
  const want = Math.min(dead.length, Math.min(6, 1 + s.level));
  while (s.holes.length < want) {
    const c = dead.splice(Math.floor(rng.next() * dead.length), 1)[0];
    s.holes.push(c);
  }
  reset(s);
}

function reset(s: LabState) {
  s.ball = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  s.t = 0;
  s.falling = 0;
}

export function newGame(rng: Rng): LabState {
  const s: LabState = {
    level: 0, n: 0, right: [], down: [], holes: [], ball: { x: 0.5, y: 0.5, vx: 0, vy: 0 }, tilt: { x: 0, y: 0 }, t: 0,
    lives: LIVES, falling: 0, score: 0, alive: true,
  };
  setup(s, rng);
  return s;
}

export function setTilt(s: LabState, x: number, y: number) {
  const m = Math.hypot(x, y);
  const k = m > 1 ? 1 / m : 1;
  s.tilt = { x: x * k, y: y * k };
}

export const levelPoints = (n: number, t: number) => Math.max(100, Math.round(n * 150 - t * 10));

export function step(s: LabState, dt: number, rng: Rng): Event[] {
  const ev: Event[] = [];
  if (!s.alive) return ev;
  if (s.falling > 0) {
    s.falling -= dt;
    if (s.falling <= 0) {
      if (s.lives <= 0) {
        s.alive = false;
        ev.push("dead");
      } else reset(s);
    }
    return ev;
  }
  s.t += dt;
  const b = s.ball;
  b.vx = (b.vx + s.tilt.x * ACCEL * dt) * DAMP ** dt;
  b.vy = (b.vy + s.tilt.y * ACCEL * dt) * DAMP ** dt;
  const segs = segments(s);
  const n = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / (BALL_R * 0.4)));
  for (let i = 0; i < n; i++) {
    b.x += (b.vx * dt) / n;
    b.y += (b.vy * dt) / n;
    for (const [x0, y0, x1, y1] of segs) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const t = Math.max(0, Math.min(1, ((b.x - x0) * dx + (b.y - y0) * dy) / (dx * dx + dy * dy)));
      const ox = b.x - (x0 + t * dx);
      const oy = b.y - (y0 + t * dy);
      const d = Math.hypot(ox, oy);
      if (d >= BALL_R || d === 0) continue;
      const nx = ox / d;
      const ny = oy / d;
      b.x += nx * (BALL_R - d);
      b.y += ny * (BALL_R - d);
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= (1 + WALL_E) * vn * nx;
        b.vy -= (1 + WALL_E) * vn * ny;
        if (-vn > 3) ev.push("bump");
      }
    }
  }
  for (const [hx, hy] of s.holes)
    if (Math.hypot(b.x - (hx + 0.5), b.y - (hy + 0.5)) < HOLE_R) {
      b.x = hx + 0.5;
      b.y = hy + 0.5;
      b.vx = b.vy = 0;
      s.lives--;
      s.falling = 0.9;
      ev.push("fall");
      return ev;
    }
  if (Math.hypot(b.x - (s.n - 0.5), b.y - (s.n - 0.5)) < 0.35) {
    s.score += levelPoints(s.n, s.t);
    s.level++;
    setup(s, rng);
    ev.push("goal");
  }
  return ev;
}
