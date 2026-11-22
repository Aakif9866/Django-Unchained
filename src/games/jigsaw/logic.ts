/**
 * Jigsaw rules. Pure: no DOM, no clock (time arrives through tick()).
 * The picture is cut into a cols × rows grid. Every inside edge is a seeded tab or blank, so neighbours always fit.
 * Positions are in cell units relative to the board's top-left; piece i belongs at (i % cols, ⌊i / cols⌋).
 * Drop a piece close to its home and it snaps and locks. Placing all of them solves the puzzle.
 */
import type { Rng } from "@/engine/rng";

export type Level = 0 | 1 | 2;
export const GRIDS: [number, number][] = [[4, 3], [6, 4], [8, 6]]; // Easy 12, Medium 24, Hard 48 pieces
export const SNAP = 0.3; // cells
export const HEROES = 9999;

export interface Piece {
  x: number;
  y: number;
  done: boolean;
}
export interface JigsawState {
  seed: number; // which hero (1..HEROES)
  cols: number;
  rows: number;
  /** h[r*(cols-1)+c]: edge between (c,r) and (c+1,r). v[r*cols+c]: edge between (c,r) and (c,r+1). +1 = tab on the first piece. */
  h: number[];
  v: number[];
  pieces: Piece[];
  order: number[]; // draw order, last on top
  time: number;
  score: number;
  solved: boolean;
}

export function createPuzzle(rng: Rng, level: Level): JigsawState {
  const [cols, rows] = GRIDS[level];
  const sign = () => (rng.next() < 0.5 ? 1 : -1);
  const n = cols * rows;
  return {
    seed: rng.int(1, HEROES),
    cols,
    rows,
    h: Array.from({ length: rows * (cols - 1) }, sign),
    v: Array.from({ length: (rows - 1) * cols }, sign),
    pieces: Array.from({ length: n }, () => ({ x: 0, y: 0, done: false })),
    order: Array.from({ length: n }, (_, i) => i),
    time: 0,
    score: 0,
    solved: false,
  };
}

/** [top, right, bottom, left] for piece i: +1 tab out, -1 blank in, 0 flat border. */
export function sides(s: JigsawState, i: number): [number, number, number, number] {
  const c = i % s.cols, r = Math.floor(i / s.cols);
  return [
    r > 0 ? -s.v[(r - 1) * s.cols + c] : 0,
    c < s.cols - 1 ? s.h[r * (s.cols - 1) + c] : 0,
    r < s.rows - 1 ? s.v[r * s.cols + c] : 0,
    c > 0 ? -s.h[r * (s.cols - 1) + c - 1] : 0,
  ];
}

/** Scatters every loose piece inside a rectangle (cell units), shuffling the draw order. */
export function scatter(s: JigsawState, rng: Rng, area: { x: number; y: number; w: number; h: number }) {
  for (const p of s.pieces) {
    if (p.done) continue;
    p.x = area.x + rng.next() * Math.max(0, area.w - 1);
    p.y = area.y + rng.next() * Math.max(0, area.h - 1);
  }
  for (let i = s.order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [s.order[i], s.order[j]] = [s.order[j], s.order[i]];
  }
}

export function bringToFront(s: JigsawState, i: number) {
  s.order = [...s.order.filter((k) => k !== i), i];
}

const finish = (s: JigsawState) => {
  if (!s.pieces.every((p) => p.done)) return;
  s.solved = true;
  s.score += timeBonus(s);
};
/** Up to 8 s per piece is par; every second under par is worth 2 points. */
export const timeBonus = (s: JigsawState) => Math.max(0, Math.round(s.pieces.length * 8 - s.time)) * 2;

/** Moves piece i to (x, y). Returns true when it snapped home. */
export function drop(s: JigsawState, i: number, x: number, y: number): boolean {
  const p = s.pieces[i];
  if (!p || p.done || s.solved) return false;
  const hx = i % s.cols, hy = Math.floor(i / s.cols);
  if (Math.abs(x - hx) < SNAP && Math.abs(y - hy) < SNAP) {
    Object.assign(p, { x: hx, y: hy, done: true });
    s.score += 10;
    finish(s);
    return true;
  }
  p.x = x;
  p.y = y;
  return false;
}

/** Places the first loose piece for free (no points). Returns its index, or -1. */
export function hint(s: JigsawState): number {
  const i = s.pieces.findIndex((p) => !p.done);
  if (i < 0 || s.solved) return -1;
  Object.assign(s.pieces[i], { x: i % s.cols, y: Math.floor(i / s.cols), done: true });
  finish(s);
  return i;
}

export function tick(s: JigsawState, dt: number) {
  if (!s.solved) s.time += dt;
}

export const placed = (s: JigsawState) => s.pieces.filter((p) => p.done).length;
