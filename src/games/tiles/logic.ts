/**
 * Tiles rules (tile-matching solitaire). Pure: no DOM, no clock.
 * Tiles sit on a grid in layers. A tile is free when nothing lies on it and its left or right side is open.
 * Match two free tiles with the same face to clear them.
 * Solvable by construction: faces are assigned in pairs while taking the layout apart in a legal order, so that
 * order always exists. Shuffles (two per run) re-deal the remaining faces the same way; stuck with none left ends the run.
 */
import type { Rng } from "@/engine/rng";

export interface Tile {
  x: number;
  y: number;
  z: number;
  face: number;
  gone: boolean;
}
export interface TilesState {
  tiles: Tile[];
  level: number;
  score: number;
  shuffles: number;
  alive: boolean;
  cleared: boolean;
}
export const FACES = 18;

/** Layouts: each layer is [x0, y0, w, h]; layers stack upward. */
const LAYOUTS: [number, number, number, number][][] = [
  [[0, 0, 4, 6], [1, 1, 2, 4]],
  [[0, 0, 6, 6], [1, 1, 4, 4], [2, 2, 2, 2]],
  [[0, 0, 6, 8], [1, 1, 4, 6], [2, 2, 2, 4], [2, 3, 2, 2]],
];
export const layoutFor = (level: number) => LAYOUTS[Math.min(level, LAYOUTS.length) - 1];

const at = (tiles: Tile[], x: number, y: number, z: number) => tiles.some((t) => !t.gone && t.x === x && t.y === y && t.z === z);
export function isFree(tiles: Tile[], t: Tile): boolean {
  if (t.gone || at(tiles, t.x, t.y, t.z + 1)) return false;
  return !at(tiles, t.x - 1, t.y, t.z) || !at(tiles, t.x + 1, t.y, t.z);
}

/** Give the live tiles faces in pairs along a legal removal order. Returns that order (tile index pairs), or null if stuck. */
export function deal(tiles: Tile[], rng: Rng): [number, number][] | null {
  const live = tiles.filter((t) => !t.gone);
  const ghost = live.map((t) => ({ ...t })); // removed one pair at a time
  const faces = Array.from({ length: live.length / 2 }, (_, k) => k % FACES);
  const order: [number, number][] = [];
  for (const f of faces) {
    const free = ghost.filter((t) => isFree(ghost, t));
    if (free.length < 2) return null;
    const a = free.splice(rng.int(0, free.length - 1), 1)[0];
    const b = free[rng.int(0, free.length - 1)];
    for (const g of [a, b]) {
      g.gone = true;
      live[ghost.indexOf(g)].face = f;
    }
    order.push([tiles.indexOf(live[ghost.indexOf(a)]), tiles.indexOf(live[ghost.indexOf(b)])]);
  }
  return order;
}

function board(level: number, score: number, shuffles: number, rng: Rng): TilesState {
  const tiles: Tile[] = [];
  layoutFor(level).forEach(([x0, y0, w, h], z) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) tiles.push({ x, y, z, face: 0, gone: false });
  });
  while (!deal(tiles, rng));
  return { tiles, level, score, shuffles, alive: true, cleared: false };
}
export const newGame = (rng: Rng, d = 1) => board(1, 0, [3, 2, 1][d], rng);
export const nextBoard = (s: TilesState, rng: Rng) => Object.assign(s, board(s.level + 1, s.score, s.shuffles, rng));

export function hasMove(s: TilesState): boolean {
  const free = s.tiles.filter((t) => isFree(s.tiles, t));
  return free.some((a, i) => free.some((b, j) => j > i && a.face === b.face));
}

export type Matched = "match" | "nope" | "cleared" | "stuck" | null;

/** Try to clear two tiles (by index). Settles cleared / stuck (no shuffles left = run over). */
export function match(s: TilesState, i: number, j: number): Matched {
  const a = s.tiles[i], b = s.tiles[j];
  if (!s.alive || s.cleared || i === j || !a || !b || !isFree(s.tiles, a) || !isFree(s.tiles, b)) return null;
  if (a.face !== b.face) return "nope";
  a.gone = b.gone = true;
  s.score += 10 * s.level;
  if (s.tiles.every((t) => t.gone)) {
    s.cleared = true;
    s.score += 100 * s.level;
    return "cleared";
  }
  if (!hasMove(s)) {
    if (!s.shuffles) s.alive = false;
    return "stuck";
  }
  return "match";
}

/** Re-deal the remaining faces so the board is solvable again. Uses one shuffle. */
export function shuffle(s: TilesState, rng: Rng): boolean {
  if (!s.alive || s.cleared || s.shuffles <= 0) return false;
  s.shuffles--;
  for (let tries = 0; tries < 50 && !deal(s.tiles, rng); tries++);
  return true;
}
