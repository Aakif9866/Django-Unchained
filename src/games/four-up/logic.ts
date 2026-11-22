/**
 * Four Up rules and engine. Pure: no DOM, no clock.
 * 7 columns × 6 rows; cell = row * 7 + col with row 0 at the bottom. Discs are 1 / -1; side 1 always starts.
 * A run is a ladder of games: win and the next engine is stronger, draw and it stays, lose and the run ends.
 */
import type { Rng } from "@/engine/rng";
import { WIN, search, type Position } from "../search";

export const COLS = 7;
export const ROWS = 6;
export type Color = 1 | -1;

export interface FourState {
  grid: number[];
  turn: Color;
  you: Color; // you start (1) in even games, the engine in odd ones
  level: number; // 1 + games won
  games: number;
  score: number;
  last: number; // last cell played, or -1
  ply: number;
  line: number[]; // cells of the winning line(s), empty while playing
  result: null | { kind: "win" | "loss" | "draw"; points: number };
}

export const WIN_PTS = 200;
export const DRAW_PTS = 100;

// Every line of four on the board (69 of them), and the lines through each cell.
export const LINES: number[][] = [];
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++)
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
      if (cells.every(([y, x]) => y < ROWS && x >= 0 && x < COLS)) LINES.push(cells.map(([y, x]) => y * COLS + x));
    }
const THROUGH: number[][][] = Array.from({ length: ROWS * COLS }, (_, i) => LINES.filter((l) => l.includes(i)));

export const heightOf = (grid: number[], col: number) => {
  let r = 0;
  while (r < ROWS && grid[r * COLS + col]) r++;
  return r;
};

/** Cells of every four-in-a-row through `cell` (empty if none). */
export function winLine(grid: number[], cell: number): number[] {
  const v = grid[cell];
  const out = new Set<number>();
  if (v) for (const l of THROUGH[cell]) if (l.every((i) => grid[i] === v)) l.forEach((i) => out.add(i));
  return [...out];
}
const wins = (grid: number[], cell: number) => THROUGH[cell].some((l) => l.every((i) => grid[i] === grid[cell]));

// ---------- engine ----------

const ORDER = [3, 2, 4, 1, 5, 0, 6]; // centre first: better moves first means far more pruning
const WEIGHT = [0, 0, 2, 5];

function positionOf(grid: number[], turn: Color): Position {
  const g = grid.slice();
  const h = Array.from({ length: COLS }, (_, c) => heightOf(g, c));
  const played: number[] = [];
  const won: boolean[] = [];
  let side = turn;
  let filled = g.filter(Boolean).length;
  return {
    moves: () => ORDER.filter((c) => h[c] < ROWS),
    make(c) {
      const cell = h[c]++ * COLS + c;
      g[cell] = side;
      played.push(c);
      won.push(wins(g, cell));
      filled++;
      side = -side as Color;
    },
    undo() {
      const c = played.pop()!;
      g[--h[c] * COLS + c] = 0;
      won.pop();
      filled--;
      side = -side as Color;
    },
    over: () => (won[won.length - 1] ? -WIN : filled === ROWS * COLS ? 0 : null), // the last mover won
    evaluate() {
      let s = 0;
      for (const l of LINES) {
        let mine = 0, theirs = 0;
        for (const i of l) {
          if (g[i] === side) mine++;
          else if (g[i]) theirs++;
        }
        if (!theirs) s += WEIGHT[mine];
        else if (!mine) s -= WEIGHT[theirs];
      }
      for (let r = 0; r < ROWS; r++) if (g[r * COLS + 3]) s += g[r * COLS + 3] === side ? 3 : -3;
      return s;
    },
  };
}

export const LEVELS = [
  { name: "Novice", depth: 2, noise: 8 },
  { name: "Club", depth: 4, noise: 3 },
  { name: "Expert", depth: 6, noise: 1 },
  { name: "Master", depth: 16, noise: 0 },
];
export const tier = (level: number) => LEVELS[Math.min(level, LEVELS.length) - 1];
export const THINK_MS = 1200;

/** The engine's column. `now` (ms) enables the time budget; without it the search is depth-limited and exact. */
export function think(grid: number[], turn: Color, level: number, rng: Rng, now?: () => number) {
  const L = tier(level);
  const end = now ? now() + THINK_MS : 0;
  return search(positionOf(grid, turn), { depth: L.depth, noise: L.noise, random: () => rng.next(), stop: now && (() => now() > end) });
}

// ---------- the game ----------

function startGame(games: number) {
  return { grid: Array(ROWS * COLS).fill(0), turn: 1 as Color, you: (games % 2 === 0 ? 1 : -1) as Color, last: -1, ply: 0, line: [], result: null };
}

export function newGame(level = 1): FourState {
  return { level, games: 0, score: 0, ...startGame(0) };
}

/** Drop a disc for whoever's turn it is. Returns the cell it lands in, or -1 if the column is full or the game is over. */
export function drop(s: FourState, col: number): number {
  if (s.result || col < 0 || col >= COLS) return -1;
  const r = heightOf(s.grid, col);
  if (r >= ROWS) return -1;
  const cell = r * COLS + col;
  s.grid[cell] = s.turn;
  s.last = cell;
  s.ply++;
  s.line = winLine(s.grid, cell);
  if (s.line.length || s.ply === ROWS * COLS) {
    const kind = !s.line.length ? "draw" : s.turn === s.you ? "win" : "loss";
    // A quicker win is worth more: every empty cell left adds to it.
    const points = kind === "win" ? (WIN_PTS + 5 * (ROWS * COLS - s.ply)) * s.level : kind === "draw" ? DRAW_PTS * s.level : 0;
    s.score += points;
    s.result = { kind, points };
  }
  s.turn = -s.turn as Color;
  return cell;
}

/** After a win or draw: the next game, with the first move passing to the other side. */
export function nextGame(s: FourState) {
  if (!s.result || s.result.kind === "loss") return;
  if (s.result.kind === "win") s.level++;
  s.games++;
  Object.assign(s, startGame(s.games));
}
