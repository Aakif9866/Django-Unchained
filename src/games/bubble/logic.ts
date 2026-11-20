/**
 * Bubble rules. Pure: no DOM, no clock. World 100 × 150, offset hex grid hanging from the top.
 * Odd rows (by parity, which flips when a new row pushes in) are shifted half a bubble and hold COLS-1 bubbles.
 */
import type { Rng } from "@/engine/rng";

export const W = 100;
export const H = 150;
export const COLS = 10;
export const R = W / COLS / 2; // 5
export const D = R * 2;
export const ROW_H = D * (Math.sqrt(3) / 2);
export const TOP = 4;
export const SHOOTER = { x: W / 2, y: 140 };
export const DEAD_ROW = 14; // a bubble settling in this row ends the game
export const SPEED = 230;
export const MISSES_PER_ROW = 5;
export const COLORS = 5;

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
}
export interface BubbleState {
  grid: Record<string, number>; // "r,c" → colour 0..COLORS-1
  shift: number; // 0/1: row parity offset
  aim: number; // radians, pointing up = -PI/2
  cur: number;
  next: number;
  shot: Shot | null;
  misses: number;
  score: number;
  level: number;
  alive: boolean;
}
export interface Landed {
  popped: { r: number; c: number; color: number }[];
  dropped: { r: number; c: number; color: number }[];
  pushed: boolean;
  cleared: boolean;
}

export const key = (r: number, c: number) => `${r},${c}`;
export const parse = (k: string) => k.split(",").map(Number) as [number, number];
export const odd = (s: BubbleState, r: number) => (r + s.shift) % 2 === 1;
export const rowLen = (s: BubbleState, r: number) => (odd(s, r) ? COLS - 1 : COLS);
export const center = (s: BubbleState, r: number, c: number) => ({ x: R + c * D + (odd(s, r) ? R : 0), y: TOP + R + r * ROW_H });

export function neighbors(s: BubbleState, r: number, c: number): [number, number][] {
  const o = odd(s, r) ? 1 : 0;
  const out: [number, number][] = [
    [r, c - 1], [r, c + 1], [r - 1, c - 1 + o], [r - 1, c + o], [r + 1, c - 1 + o], [r + 1, c + o],
  ];
  return out.filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < rowLen(s, rr));
}

const MIN_AIM = -Math.PI + 0.12;
const MAX_AIM = -0.12;
export const setAim = (s: BubbleState, a: number) => {
  s.aim = Math.max(MIN_AIM, Math.min(MAX_AIM, a));
};

function boardColors(s: BubbleState): number[] {
  return [...new Set(Object.values(s.grid))];
}
/** New shots only use colours still on the board, so every shot can matter. */
function pickColor(s: BubbleState, rng: Rng) {
  const cs = boardColors(s);
  return cs.length ? rng.pick(cs) : rng.int(0, COLORS - 1);
}

function fillBoard(s: BubbleState, rng: Rng) {
  s.grid = {};
  const rows = Math.min(9, 5 + s.level);
  const colors = Math.min(COLORS, 3 + s.level);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < rowLen(s, r); c++) {
      // Bias toward the left neighbour's colour so the board has clusters, not noise.
      const left = s.grid[key(r, c - 1)];
      s.grid[key(r, c)] = left !== undefined && rng.next() < 0.45 ? left : rng.int(0, colors - 1);
    }
}

export function newGame(rng: Rng): BubbleState {
  const s: BubbleState = { grid: {}, shift: 0, aim: -Math.PI / 2, cur: 0, next: 0, shot: null, misses: 0, score: 0, level: 0, alive: true };
  fillBoard(s, rng);
  s.cur = pickColor(s, rng);
  s.next = pickColor(s, rng);
  return s;
}

export function fire(s: BubbleState) {
  if (s.shot || !s.alive) return false;
  s.shot = { x: SHOOTER.x, y: SHOOTER.y, vx: Math.cos(s.aim) * SPEED, vy: Math.sin(s.aim) * SPEED, color: s.cur };
  return true;
}

export function swap(s: BubbleState) {
  if (s.shot) return;
  [s.cur, s.next] = [s.next, s.cur];
}

function nearestFree(s: BubbleState, x: number, y: number): [number, number] {
  const r0 = Math.max(0, Math.round((y - TOP - R) / ROW_H));
  let best: [number, number] = [r0, 0];
  let bd = Infinity;
  for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++)
    for (let c = 0; c < rowLen(s, r); c++) {
      if (s.grid[key(r, c)] !== undefined) continue;
      // Must hang from the ceiling or touch a bubble.
      if (r > 0 && !neighbors(s, r, c).some(([a, b]) => s.grid[key(a, b)] !== undefined)) continue;
      const p = center(s, r, c);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = [r, c];
      }
    }
  return best;
}

function connectedToTop(s: BubbleState): Set<string> {
  const seen = new Set<string>();
  const stack = Object.keys(s.grid).filter((k) => parse(k)[0] === 0);
  while (stack.length) {
    const k = stack.pop()!;
    if (seen.has(k)) continue;
    seen.add(k);
    const [r, c] = parse(k);
    for (const [a, b] of neighbors(s, r, c)) if (s.grid[key(a, b)] !== undefined) stack.push(key(a, b));
  }
  return seen;
}

function pushRow(s: BubbleState, rng: Rng) {
  const g: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.grid)) {
    const [r, c] = parse(k);
    g[key(r + 1, c)] = v;
  }
  s.grid = g;
  s.shift = 1 - s.shift; // keeps every existing bubble's offset
  const cs = boardColors(s);
  for (let c = 0; c < rowLen(s, 0); c++) s.grid[key(0, c)] = cs.length ? rng.pick(cs) : rng.int(0, COLORS - 1);
}

export function place(s: BubbleState, r: number, c: number, color: number, rng: Rng): Landed {
  s.grid[key(r, c)] = color;
  const res: Landed = { popped: [], dropped: [], pushed: false, cleared: false };
  // Flood fill same colour.
  const group = new Set<string>();
  const stack = [key(r, c)];
  while (stack.length) {
    const k = stack.pop()!;
    if (group.has(k)) continue;
    group.add(k);
    const [a, b] = parse(k);
    for (const [na, nb] of neighbors(s, a, b)) if (s.grid[key(na, nb)] === color) stack.push(key(na, nb));
  }
  if (group.size >= 3) {
    for (const k of group) {
      const [a, b] = parse(k);
      res.popped.push({ r: a, c: b, color: s.grid[k] });
      delete s.grid[k];
    }
    const hung = connectedToTop(s);
    for (const k of Object.keys(s.grid))
      if (!hung.has(k)) {
        const [a, b] = parse(k);
        res.dropped.push({ r: a, c: b, color: s.grid[k] });
        delete s.grid[k];
      }
    // Drops are worth more the bigger the avalanche.
    s.score += res.popped.length * 10 + res.dropped.length * 20 * Math.max(1, Math.floor(res.dropped.length / 3));
  } else if (++s.misses >= MISSES_PER_ROW) {
    s.misses = 0;
    pushRow(s, rng);
    res.pushed = true;
  }
  if (Object.keys(s.grid).length === 0) {
    s.score += 1000;
    s.level++;
    s.misses = 0;
    fillBoard(s, rng);
    res.cleared = true;
  }
  if (Object.keys(s.grid).some((k) => parse(k)[0] >= DEAD_ROW)) s.alive = false;
  s.cur = s.next;
  if (!boardColors(s).includes(s.cur)) s.cur = pickColor(s, rng);
  s.next = pickColor(s, rng);
  return res;
}

/** Moves the shot; returns what happened when it lands, else null. */
export function step(s: BubbleState, dt: number, rng: Rng): Landed | null {
  const sh = s.shot;
  if (!sh || !s.alive) return null;
  const n = Math.max(1, Math.ceil((SPEED * dt) / 1.5));
  for (let i = 0; i < n; i++) {
    sh.x += (sh.vx * dt) / n;
    sh.y += (sh.vy * dt) / n;
    if (sh.x < R) {
      sh.x = R;
      sh.vx = Math.abs(sh.vx);
    } else if (sh.x > W - R) {
      sh.x = W - R;
      sh.vx = -Math.abs(sh.vx);
    }
    const touching =
      sh.y <= TOP + R ||
      Object.keys(s.grid).some((k) => {
        const [r, c] = parse(k);
        const p = center(s, r, c);
        return (p.x - sh.x) ** 2 + (p.y - sh.y) ** 2 < (D * 0.85) ** 2;
      });
    if (touching) {
      const [r, c] = nearestFree(s, sh.x, sh.y);
      s.shot = null;
      return place(s, r, c, sh.color, rng);
    }
  }
  return null;
}
