/** Coil rules. Pure: no DOM, no clock. The renderer only reads this state. */
import type { Rng } from "@/engine/rng";

export type Dir = "up" | "down" | "left" | "right";
export interface P {
  x: number;
  y: number;
}
export interface CoilState {
  w: number;
  h: number;
  snake: P[]; // head first
  prev: P[]; // positions before the last tick, for smooth interpolation
  dir: Dir;
  queue: Dir[];
  food: P;
  bonus: P | null;
  bonusTtl: number;
  score: number;
  eaten: number;
  alive: boolean;
}
export type TickResult = "move" | "eat" | "bonus" | "dead";

const V: Record<Dir, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPP: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
export const BONUS_EVERY = 5;
export const BONUS_TICKS = 28;
export const BONUS_POINTS = 5;

/** Tick interval in ms: starts relaxed, tightens with every bite, floors at 70ms. */
export const tickMs = (eaten: number) => Math.max(70, 150 - eaten * 3);

/** Board shape follows the screen so the grid never looks squashed. */
export function boardFor(width: number, height: number): { w: number; h: number } {
  const short = 15;
  const ratio = Math.max(width, height) / Math.max(1, Math.min(width, height));
  const long = Math.min(27, Math.max(short, Math.round(short * ratio)));
  return width >= height ? { w: long, h: short } : { w: short, h: long };
}

export function newGame(w: number, h: number, rng: Rng): CoilState {
  const cy = Math.floor(h / 2);
  const cx = Math.floor(w / 2);
  const snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
  const s: CoilState = {
    w, h, snake, prev: snake.map((p) => ({ ...p })), dir: "right", queue: [],
    food: { x: 0, y: 0 }, bonus: null, bonusTtl: 0, score: 0, eaten: 0, alive: true,
  };
  s.food = spawn(s, rng) ?? { x: 0, y: 0 };
  return s;
}

/** Buffers up to 3 turns so fast swipes around a corner are not lost; ignores reversals. */
export function turn(s: CoilState, d: Dir) {
  const last = s.queue[s.queue.length - 1] ?? s.dir;
  if (d === last || d === OPP[last] || s.queue.length >= 3) return;
  s.queue.push(d);
}

const same = (a: P, b: P) => a.x === b.x && a.y === b.y;

function spawn(s: CoilState, rng: Rng): P | null {
  const free: P[] = [];
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const p = { x, y };
      if (!s.snake.some((q) => same(q, p)) && !(s.bonus && same(s.bonus, p)) && !same(s.food, p)) free.push(p);
    }
  return free.length ? rng.pick(free) : null;
}

export function tick(s: CoilState, rng: Rng): TickResult {
  if (!s.alive) return "dead";
  s.dir = s.queue.shift() ?? s.dir;
  s.prev = s.snake.map((p) => ({ ...p }));
  const head = { x: s.snake[0].x + V[s.dir].x, y: s.snake[0].y + V[s.dir].y };
  const eatsFood = same(head, s.food);
  const eatsBonus = !!s.bonus && same(head, s.bonus);
  // The tail moves away this tick unless we grow, so stepping onto it is legal.
  const body = eatsFood ? s.snake : s.snake.slice(0, -1);
  if (head.x < 0 || head.y < 0 || head.x >= s.w || head.y >= s.h || body.some((p) => same(p, head))) {
    s.alive = false;
    return "dead";
  }
  s.snake = [head, ...body];

  if (s.bonus && --s.bonusTtl <= 0) s.bonus = null;
  if (eatsBonus) {
    s.score += BONUS_POINTS;
    s.bonus = null;
  }
  if (eatsFood) {
    s.score += 1;
    s.eaten += 1;
    const next = spawn(s, rng);
    if (!next) {
      s.alive = false; // board full: nothing left to eat
      return "dead";
    }
    s.food = next;
    if (s.eaten % BONUS_EVERY === 0) {
      s.bonus = spawn(s, rng);
      s.bonusTtl = BONUS_TICKS;
    }
    return "eat";
  }
  return eatsBonus ? "bonus" : "move";
}
