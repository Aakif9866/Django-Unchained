/**
 * Pairs rules. Pure: no DOM, no clock (time arrives through tick()).
 * A seeded shuffle lays out pairs of symbols face down. Flip two: a match stays up, a miss turns back on your next
 * flip. Each board has a time limit; clearing it banks the time left and deals a bigger board. Time running out ends the run.
 */
import type { Rng } from "@/engine/rng";

export interface PairsState {
  cols: number;
  rows: number;
  cards: number[]; // symbol id per slot
  matched: boolean[];
  open: number[]; // face-up, unmatched cards (0–2)
  time: number; // seconds left
  level: number;
  d?: number; // difficulty 0 Easy, 1 Medium, 2 Hard (missing = Medium)
  score: number;
  streak: number; // matches in a row, for a bonus
  alive: boolean;
  cleared: boolean;
}
export const SYMBOLS = 12;

const TIME_K = [1.3, 1, 0.75];
export function sizeFor(level: number, d = 1) {
  const sizes: [number, number][] = [[3, 4], [4, 4], [4, 5], [4, 6]];
  const [cols, rows] = sizes[Math.min(level, sizes.length) - 1];
  return { cols, rows, time: Math.round(((cols * rows) * 3.5 + 10) * TIME_K[d]) };
}

function board(level: number, score: number, rng: Rng, d = 1): PairsState {
  const { cols, rows, time } = sizeFor(level, d);
  const n = (cols * rows) / 2;
  const ids = Array.from({ length: SYMBOLS }, (_, i) => i);
  const pick: number[] = [];
  for (let k = 0; k < n; k++) pick.push(ids.splice(rng.int(0, ids.length - 1), 1)[0]);
  const cards = [...pick, ...pick];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cols, rows, cards, matched: cards.map(() => false), open: [], time, level, score, streak: 0, alive: true, cleared: false, d };
}
export const newGame = (rng: Rng, d = 1) => board(1, 0, rng, d);
export const nextBoard = (s: PairsState, rng: Rng) => Object.assign(s, board(s.level + 1, s.score, rng, s.d ?? 1));

export type Flipped = "open" | "match" | "miss" | "cleared" | null;

export function flip(s: PairsState, i: number): Flipped {
  if (!s.alive || s.cleared || i < 0 || i >= s.cards.length || s.matched[i] || s.open.includes(i)) return null;
  if (s.open.length === 2) s.open = []; // a shown miss turns back as you carry on
  s.open.push(i);
  if (s.open.length < 2) return "open";
  const [a, b] = s.open;
  if (s.cards[a] !== s.cards[b]) {
    s.streak = 0;
    return "miss";
  }
  s.matched[a] = s.matched[b] = true;
  s.open = [];
  s.streak++;
  s.score += 10 * s.level * s.streak;
  if (s.matched.every(Boolean)) {
    s.cleared = true;
    s.score += 50 * s.level + Math.ceil(s.time) * 2;
    return "cleared";
  }
  return "match";
}

export function tick(s: PairsState, dt: number) {
  if (!s.alive || s.cleared) return;
  s.time = Math.max(0, s.time - dt);
  if (s.time === 0) s.alive = false;
}
