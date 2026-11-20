/**
 * Pipe Flow rules and generator. Pure: no DOM, no clock. cell = row * n + col.
 * Each tile is a bitmask of openings: 1 = up, 2 = right, 4 = down, 8 = left. A tap turns a tile a quarter clockwise.
 * The generator grows a random spanning tree from the source in the middle, so a solution always exists,
 * then scrambles every tile. Solved = every opening meets an opening, and water reaches every tile.
 * Par counts the fewest taps back to the generated layout; each level allows par + slack.
 */
import type { Rng } from "@/engine/rng";

export const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
const DIRS: [number, number, number, number][] = [
  [UP, -1, 0, DOWN],
  [RIGHT, 0, 1, LEFT],
  [DOWN, 1, 0, UP],
  [LEFT, 0, -1, RIGHT],
];
export interface PipeState {
  n: number;
  tiles: number[];
  goal: number[]; // the generated layout (one solution)
  source: number;
  par: number;
  movesLeft: number;
  level: number;
  score: number;
  alive: boolean;
  solved: boolean;
}

export const sizeFor = (level: number) => (level <= 2 ? 5 : level <= 5 ? 6 : 7);
export const turn = (m: number) => ((m << 1) | (m >> 3)) & 15;
/** Fewest clockwise quarter-turns from `m` to `target` (straights and crosses have shorter cycles). */
export function turnsTo(m: number, target: number) {
  for (let k = 0; k < 4; k++, m = turn(m)) if (m === target) return k;
  return -1;
}

/** Tiles water reaches from the source, following openings that meet. */
export function reached(s: Pick<PipeState, "n" | "tiles" | "source">): Set<number> {
  const seen = new Set([s.source]);
  const todo = [s.source];
  while (todo.length) {
    const i = todo.pop()!;
    const r = Math.floor(i / s.n), c = i % s.n;
    for (const [bit, dr, dc, back] of DIRS) {
      const rr = r + dr, cc = c + dc, j = rr * s.n + cc;
      if (!(s.tiles[i] & bit) || rr < 0 || rr >= s.n || cc < 0 || cc >= s.n || !(s.tiles[j] & back) || seen.has(j)) continue;
      seen.add(j);
      todo.push(j);
    }
  }
  return seen;
}

export function isSolved(s: Pick<PipeState, "n" | "tiles" | "source">): boolean {
  for (let i = 0; i < s.n * s.n; i++) {
    const r = Math.floor(i / s.n), c = i % s.n;
    for (const [bit, dr, dc, back] of DIRS) {
      if (!(s.tiles[i] & bit)) continue;
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= s.n || cc < 0 || cc >= s.n || !(s.tiles[rr * s.n + cc] & back)) return false; // a leak
    }
  }
  return reached(s).size === s.n * s.n;
}

function level(levelNo: number, score: number, rng: Rng): PipeState {
  const n = sizeFor(levelNo);
  const source = Math.floor(n / 2) * n + Math.floor(n / 2);
  for (;;) {
    // Random spanning tree (randomised Prim's): every tile joins the network exactly once.
    const tiles = Array(n * n).fill(0);
    const inTree = new Set([source]);
    const frontier: [number, number, number, number][] = []; // [from, to, bit, back]
    const grow = (i: number) => {
      const r = Math.floor(i / n), c = i % n;
      for (const [bit, dr, dc, back] of DIRS) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) frontier.push([i, rr * n + cc, bit, back]);
      }
    };
    grow(source);
    while (inTree.size < n * n) {
      const [from, to, bit, back] = frontier.splice(rng.int(0, frontier.length - 1), 1)[0];
      if (inTree.has(to)) continue;
      // Keep tiles to 3 openings at most: crosses make puzzles trivial.
      if ([1, 2, 4, 8].filter((b) => tiles[from] & b).length >= 3) continue;
      tiles[from] |= bit;
      tiles[to] |= back;
      inTree.add(to);
      grow(to);
      if (!frontier.length) break;
    }
    if (inTree.size < n * n) continue;
    const solved = tiles.slice();
    let par = 0;
    for (let i = 0; i < n * n; i++) {
      for (let k = rng.int(0, 3); k > 0; k--) tiles[i] = turn(tiles[i]);
      par += turnsTo(tiles[i], solved[i]);
    }
    const s = { n, tiles, goal: solved, source, par, movesLeft: par + Math.max(4, n + 2 - Math.floor(levelNo / 3)), level: levelNo, score, alive: true, solved: false };
    if (par >= n && !isSolved(s)) return s;
  }
}

export const newGame = (rng: Rng) => level(1, 0, rng);
export const nextLevel = (s: PipeState, rng: Rng) => Object.assign(s, level(s.level + 1, s.score, rng));

/** Turn a tile a quarter clockwise. Spends a move; settles solved / out of moves. */
export function rotate(s: PipeState, cell: number): boolean {
  if (!s.alive || s.solved || cell < 0 || cell >= s.n * s.n) return false;
  s.tiles[cell] = turn(s.tiles[cell]);
  s.movesLeft--;
  if (isSolved(s)) {
    s.solved = true;
    s.score += 60 * s.level + 15 * s.movesLeft;
  } else if (s.movesLeft <= 0) s.alive = false;
  return true;
}
