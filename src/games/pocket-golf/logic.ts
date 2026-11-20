/**
 * Pocket Golf rules. Pure: no DOM, no clock. Nine handmade holes, top-down, y grows toward the cup.
 * Ball rolls with friction, slopes push it, sand drags, water costs a stroke and puts you back.
 * Walls are line segments (circle-vs-segment with restitution, sub-stepped).
 */

export type P = [number, number];
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Hole {
  par: number;
  boundary: P[]; // closed polygon
  blocks: P[][]; // closed polygons (solid)
  walls: [P, P][]; // free-standing wall segments
  slopes: (Rect & { fx: number; fy: number })[];
  sand: Rect[];
  water: Rect[];
  tee: P;
  cup: P;
}

const rect = (x0: number, y0: number, x1: number, y1: number): P[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export const HOLES: Hole[] = [
  { par: 2, boundary: rect(0, 0, 12, 30), blocks: [], walls: [], slopes: [], sand: [], water: [], tee: [6, 3], cup: [6, 26] },
  { par: 3, boundary: [[0, 0], [10, 0], [10, 20], [24, 20], [24, 31], [0, 31]], blocks: [], walls: [], slopes: [], sand: [], water: [], tee: [5, 3], cup: [20, 26] },
  { par: 2, boundary: rect(0, 0, 14, 32), blocks: [rect(4, 13, 10, 18)], walls: [], slopes: [], sand: [], water: [], tee: [7, 3], cup: [7, 28] },
  { par: 3, boundary: rect(0, 0, 12, 34), blocks: [], walls: [], slopes: [{ x0: 0, y0: 12, x1: 12, y1: 22, fx: 0, fy: -7 }], sand: [], water: [], tee: [6, 3], cup: [6, 30] },
  { par: 3, boundary: rect(0, 0, 16, 36), blocks: [], walls: [[[0, 12], [11, 12]], [[5, 24], [16, 24]]], slopes: [], sand: [], water: [], tee: [3, 3], cup: [13, 32] },
  { par: 3, boundary: rect(0, 0, 14, 34), blocks: [], walls: [], slopes: [], sand: [], water: [{ x0: 0, y0: 14, x1: 9, y1: 20 }], tee: [7, 3], cup: [6, 30] },
  { par: 2, boundary: rect(0, 0, 12, 30), blocks: [], walls: [], slopes: [{ x0: 0, y0: 8, x1: 3, y1: 30, fx: 4, fy: 0 }, { x0: 9, y0: 8, x1: 12, y1: 30, fx: -4, fy: 0 }], sand: [{ x0: 3, y0: 21, x1: 9, y1: 23.5 }], water: [], tee: [6, 3], cup: [6, 27] },
  { par: 3, boundary: rect(0, 0, 18, 30), blocks: [rect(6, 9, 18, 12)], walls: [], slopes: [{ x0: 0, y0: 18, x1: 9, y1: 30, fx: 4, fy: 0 }, { x0: 9, y0: 18, x1: 18, y1: 30, fx: -4, fy: 0 }], sand: [], water: [], tee: [3, 3], cup: [9, 25] },
  { par: 3, boundary: [[5, 0], [13, 0], [18, 8], [18, 24], [13, 32], [5, 32], [0, 24], [0, 8]], blocks: [rect(4, 14, 6, 16), rect(12, 14, 14, 16), rect(8, 19, 10, 21), rect(8, 9, 10, 11)], walls: [], slopes: [], sand: [{ x0: 6, y0: 24, x1: 12, y1: 26 }], water: [], tee: [9, 3], cup: [9, 15] },
];

export const BALL_R = 0.5;
export const CUP_R = 0.85;
export const MAX_POWER = 38;
export const SINK_SPEED = 13;
export const MAX_STROKES = 8;
const ROLL_DECEL = 3.2; // units/s² of rolling resistance
const DRAG = 0.55; // extra proportional loss per second
const SAND_DRAG = 4;
const WALL_E = 0.72;

export interface GolfState {
  hole: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  last: P; // where the ball was before this stroke
  strokes: number;
  cards: number[]; // strokes per finished hole
  moving: boolean;
  still: number; // seconds spent nearly stopped
  sunk: number; // seconds of the sink celebration left
  score: number;
  done: boolean;
}
export type Event = "wall" | "water" | "sink" | "rest" | "pickup" | "done";

const inR = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

export function segmentsOf(h: Hole): [P, P][] {
  const out: [P, P][] = [...h.walls];
  for (const poly of [h.boundary, ...h.blocks]) for (let i = 0; i < poly.length; i++) out.push([poly[i], poly[(i + 1) % poly.length]]);
  return out;
}

export function newGame(): GolfState {
  const h = HOLES[0];
  return { hole: 0, x: h.tee[0], y: h.tee[1], vx: 0, vy: 0, last: h.tee, strokes: 0, cards: [], moving: false, still: 0, sunk: 0, score: 0, done: false };
}

export const holePoints = (par: number, strokes: number) => Math.max(1, par + 3 - strokes) * 100;

export function shoot(s: GolfState, angle: number, power: number): boolean {
  if (s.moving || s.sunk > 0 || s.done) return false;
  const p = Math.max(0, Math.min(1, power)) * MAX_POWER;
  s.vx = Math.cos(angle) * p;
  s.vy = Math.sin(angle) * p;
  s.last = [s.x, s.y];
  s.strokes++;
  s.moving = true;
  s.still = 0;
  return true;
}

function nextHole(s: GolfState) {
  s.cards.push(s.strokes);
  s.score += holePoints(HOLES[s.hole].par, s.strokes);
  if (s.hole + 1 >= HOLES.length) {
    s.done = true;
    return;
  }
  s.hole++;
  const h = HOLES[s.hole];
  Object.assign(s, { x: h.tee[0], y: h.tee[1], vx: 0, vy: 0, last: h.tee, strokes: 0, moving: false });
}

export function step(s: GolfState, dt: number): Event[] {
  const ev: Event[] = [];
  if (s.done) return ev;
  if (s.sunk > 0) {
    s.sunk -= dt;
    if (s.sunk <= 0) {
      nextHole(s);
      if (s.done) ev.push("done");
    }
    return ev;
  }
  if (!s.moving) return ev;
  const h = HOLES[s.hole];
  const segs = segmentsOf(h);
  const n = Math.max(1, Math.ceil((Math.hypot(s.vx, s.vy) * dt) / (BALL_R * 0.5)));
  const sub = dt / n;
  for (let i = 0; i < n; i++) {
    for (const sl of h.slopes)
      if (inR(sl, s.x, s.y)) {
        s.vx += sl.fx * sub;
        s.vy += sl.fy * sub;
      }
    const sp = Math.hypot(s.vx, s.vy);
    const sand = h.sand.some((r) => inR(r, s.x, s.y));
    const loss = (ROLL_DECEL + (sand ? SAND_DRAG * sp * 0.5 : 0)) * sub + sp * DRAG * sub;
    if (sp > 0) {
      const k = Math.max(0, sp - loss) / sp;
      s.vx *= k;
      s.vy *= k;
    }
    s.x += s.vx * sub;
    s.y += s.vy * sub;
    for (const [a, b] of segs) {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((s.x - a[0]) * dx + (s.y - a[1]) * dy) / (dx * dx + dy * dy)));
      const cx = a[0] + t * dx;
      const cy = a[1] + t * dy;
      const ox = s.x - cx;
      const oy = s.y - cy;
      const d = Math.hypot(ox, oy);
      if (d >= BALL_R || d === 0) continue;
      const nx = ox / d;
      const ny = oy / d;
      s.x = cx + nx * BALL_R;
      s.y = cy + ny * BALL_R;
      const vn = s.vx * nx + s.vy * ny;
      if (vn < 0) {
        s.vx -= (1 + WALL_E) * vn * nx;
        s.vy -= (1 + WALL_E) * vn * ny;
        if (-vn > 2) ev.push("wall");
      }
    }
    // Cup: slow enough over the hole drops in.
    const cd = Math.hypot(s.x - h.cup[0], s.y - h.cup[1]);
    if (cd < CUP_R && Math.hypot(s.vx, s.vy) < SINK_SPEED) {
      s.x = h.cup[0];
      s.y = h.cup[1];
      s.vx = s.vy = 0;
      s.moving = false;
      s.sunk = 1.2;
      ev.push("sink");
      return ev;
    }
    if (h.water.some((r) => inR(r, s.x, s.y))) {
      [s.x, s.y] = s.last;
      s.vx = s.vy = 0;
      s.strokes++; // penalty
      s.moving = false;
      ev.push("water");
      break;
    }
  }
  // Rest only after staying slow for a moment, so a slope gets the chance to start it rolling again.
  const onSlope = h.slopes.some((sl) => inR(sl, s.x, s.y));
  s.still = Math.hypot(s.vx, s.vy) < 0.25 ? s.still + dt : 0;
  if (s.moving && s.still > (onSlope ? 0.6 : 0)) {
    s.vx = s.vy = 0;
    s.moving = false;
    ev.push("rest");
  }
  if (!s.moving && !s.sunk && s.strokes >= MAX_STROKES) {
    // Out of strokes: pick up and move on.
    s.strokes = MAX_STROKES + 1;
    s.sunk = 0.8;
    ev.push("pickup");
  }
  return ev;
}
