/**
 * Fruit Slice rules. Pure: no DOM, no clock. World 100 × 150.
 * Fruit is tossed up in arcs; swipe segments slice anything they cross. Missing a fruit costs a life,
 * slicing a bomb ends the run. Several fruits in one swipe score a combo bonus.
 */
import type { Rng } from "@/engine/rng";

export const W = 100;
export const H = 150;
export const G = 95;
export const LIVES = 3;
export const FRUITS = 6;

export interface Item {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: number; // 0..FRUITS-1, or -1 for a bomb
  a: number;
  spin: number;
  sliced: boolean;
}
export interface FruitState {
  d?: number; // difficulty 0 Easy, 1 Medium, 2 Hard (missing = Medium)
  items: Item[];
  nextId: number;
  wave: number; // seconds until the next toss
  t: number;
  lives: number;
  score: number;
  combo: { swipe: number; n: number };
  alive: boolean;
}
export interface Cut {
  item: Item;
  angle: number;
}
export type Event = "miss" | "dead";

export const waveGap = (t: number) => Math.max(0.85, 2.1 - t / 50);
const BOMB = [0.6, 1, 1.4];
export const bombChance = (t: number, d = 1) => Math.min(0.22, 0.06 + t / 600) * BOMB[d];

export function newGame(d = 1): FruitState {
  return { d, items: [], nextId: 1, wave: 0.6, t: 0, lives: LIVES, score: 0, combo: { swipe: -1, n: 0 }, alive: true };
}

function toss(s: FruitState, rng: Rng) {
  const n = Math.min(5, 1 + Math.floor(rng.next() * (1.5 + s.t / 25)));
  for (let i = 0; i < n; i++) {
    const bomb = rng.next() < bombChance(s.t, s.d ?? 1);
    const r = bomb ? 6 : 6.5 + rng.next() * 3;
    const x = 15 + rng.next() * 70;
    const apex = 55 + rng.next() * 55; // how high it climbs from the bottom
    const vy = -Math.sqrt(2 * G * apex);
    const flight = (2 * -vy) / G;
    const tx = 25 + rng.next() * 50; // drift toward the middle so it stays on screen
    s.items.push({
      id: s.nextId++, x, y: H + r, vx: (tx - x) / flight, vy, r, kind: bomb ? -1 : rng.int(0, FRUITS - 1),
      a: rng.next() * Math.PI * 2, spin: (rng.next() - 0.5) * 4, sliced: false,
    });
  }
}

export function step(s: FruitState, dt: number, rng: Rng): Event[] {
  const ev: Event[] = [];
  if (!s.alive) return ev;
  s.t += dt;
  s.wave -= dt;
  if (s.wave <= 0) {
    toss(s, rng);
    s.wave = waveGap(s.t);
  }
  for (const it of s.items) {
    it.vy += G * dt;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    it.a += it.spin * dt;
  }
  const gone = s.items.filter((it) => it.vy > 0 && it.y > H + it.r + 2);
  for (const it of gone)
    if (!it.sliced && it.kind >= 0) {
      s.lives--;
      ev.push("miss");
    }
  s.items = s.items.filter((it) => !gone.includes(it) && !it.sliced);
  if (s.lives <= 0) {
    s.alive = false;
    ev.push("dead");
  }
  return ev;
}

/** Distance from point to segment. */
function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2)) : 0;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

/** Slice with one swipe segment (world units). `swipe` groups segments of the same gesture for combos. */
export function slice(s: FruitState, x0: number, y0: number, x1: number, y1: number, swipe: number): { cuts: Cut[]; bomb: boolean; bonus: number } {
  const out = { cuts: [] as Cut[], bomb: false, bonus: 0 };
  if (!s.alive) return out;
  if (s.combo.swipe !== swipe) s.combo = { swipe, n: 0 };
  const angle = Math.atan2(y1 - y0, x1 - x0);
  for (const it of s.items) {
    if (it.sliced || segDist(it.x, it.y, x0, y0, x1, y1) > it.r) continue;
    if (it.kind < 0) {
      out.bomb = true;
      s.alive = false;
      return out;
    }
    it.sliced = true;
    s.score += 1;
    s.combo.n++;
    out.cuts.push({ item: { ...it }, angle });
    // Every fruit past the second in one swipe adds a growing bonus.
    if (s.combo.n >= 3) {
      out.bonus += s.combo.n - 2;
      s.score += s.combo.n - 2;
    }
  }
  return out;
}
