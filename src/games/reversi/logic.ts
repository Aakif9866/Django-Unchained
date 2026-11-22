/**
 * Reversi rules and engine. Pure: no DOM, no clock.
 * Board: 64 squares, row 0 at the top; 1 = black (moves first), -1 = white, 0 = empty.
 * A side with no legal move passes automatically; the game ends when neither side can move.
 * A run is a ladder of games: win and the next engine is stronger, draw and it stays, lose and the run ends.
 */
import type { Rng } from "@/engine/rng";
import { WIN, search, type Position } from "../search";

export type Color = 1 | -1;
export interface ReversiState {
  board: number[];
  turn: Color;
  you: Color; // black (first) in even games, white in odd ones
  level: number;
  games: number;
  score: number;
  last: number; // last square played, or -1
  ply: number;
  passed: Color | 0; // the side that just had to pass (for a message), or 0
  result: null | { kind: "win" | "loss" | "draw"; points: number; you: number; them: number };
}

export const WIN_PTS = 300;
export const DRAW_PTS = 100;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/** Squares that placing `color` on `sq` would flip (empty if the move is illegal). */
export function flipsFor(b: number[], sq: number, color: Color): number[] {
  if (b[sq]) return [];
  const out: number[] = [];
  const r0 = sq >> 3, c0 = sq & 7;
  for (const [dr, dc] of DIRS) {
    const run: number[] = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === -color) {
      run.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === color) out.push(...run);
  }
  return out;
}

export function movesFor(b: number[], color: Color): number[] {
  const out: number[] = [];
  for (let sq = 0; sq < 64; sq++) if (!b[sq] && flipsFor(b, sq, color).length) out.push(sq);
  return out;
}

export const count = (b: number[], color: Color) => b.reduce((n, v) => n + (v === color ? 1 : 0), 0);

// ---------- engine ----------

// Corners are gold; the squares that hand corners away are poison.
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, -1, -1, -1, -1, -2, 10,
  5, -2, -1, -1, -1, -1, -2, 5,
  5, -2, -1, -1, -1, -1, -2, 5,
  10, -2, -1, -1, -1, -1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];
export const PASS = 64;

function positionOf(board: number[], turn: Color): Position {
  const b = board.slice();
  const stack: { sq: number; flips: number[] }[] = [];
  let side = turn;
  let cache: number[] | null = null;
  const mine = () => (cache ??= movesFor(b, side).sort((x, y) => WEIGHTS[y] - WEIGHTS[x]));
  return {
    moves: () => (mine().length ? mine() : [PASS]),
    make(sq) {
      const flips = sq === PASS ? [] : flipsFor(b, sq, side);
      if (sq !== PASS) {
        b[sq] = side;
        for (const i of flips) b[i] = side;
      }
      stack.push({ sq, flips });
      side = -side as Color;
      cache = null;
    },
    undo() {
      const { sq, flips } = stack.pop()!;
      side = -side as Color;
      if (sq !== PASS) {
        b[sq] = 0;
        for (const i of flips) b[i] = -side;
      }
      cache = null;
    },
    over() {
      if (mine().length || movesFor(b, -side as Color).length) return null;
      const d = count(b, side) - count(b, -side as Color);
      return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0; // a bigger margin is a better win
    },
    evaluate() {
      let s = 0;
      for (let i = 0; i < 64; i++) if (b[i]) s += b[i] === side ? WEIGHTS[i] : -WEIGHTS[i];
      return s + 5 * (mine().length - movesFor(b, -side as Color).length);
    },
  };
}

export const LEVELS = [
  { name: "Novice", depth: 1, noise: 30, solve: 0 },
  { name: "Club", depth: 2, noise: 10, solve: 0 },
  { name: "Expert", depth: 4, noise: 3, solve: 8 },
  { name: "Master", depth: 8, noise: 0, solve: 12 },
];
export const tier = (level: number) => LEVELS[Math.min(level, LEVELS.length) - 1];
export const THINK_MS = 1500;

/** The engine's square (or PASS). Near the end, the upper levels search to the last disc. */
export function think(board: number[], turn: Color, level: number, rng: Rng, now?: () => number) {
  const L = tier(level);
  const empties = board.filter((v) => !v).length;
  const end = now ? now() + THINK_MS : 0;
  return search(positionOf(board, turn), {
    depth: empties <= L.solve ? empties + 2 : L.depth, // +2 leaves room for passes
    noise: L.noise,
    random: () => rng.next(),
    stop: now && (() => now() > end),
  });
}

// ---------- the game ----------

function startGame(games: number) {
  const board = Array(64).fill(0);
  board[27] = board[36] = -1; // d4, e5 white
  board[28] = board[35] = 1; // e4, d5 black
  return { board, turn: 1 as Color, you: (games % 2 === 0 ? 1 : -1) as Color, last: -1, ply: 0, passed: 0 as const, result: null };
}

export function newGame(level = 1): ReversiState {
  return { level, games: 0, score: 0, ...startGame(0) };
}

/** Place a disc for the side to move. Returns the flipped squares, or null if the move is illegal. */
export function place(s: ReversiState, sq: number): number[] | null {
  if (s.result || !(sq >= 0 && sq < 64)) return null;
  const flips = flipsFor(s.board, sq, s.turn);
  if (!flips.length) return null;
  s.board[sq] = s.turn;
  for (const i of flips) s.board[i] = s.turn;
  if (s.turn === s.you) s.score += flips.length * s.level;
  s.last = sq;
  s.ply++;
  const next = -s.turn as Color;
  s.passed = 0;
  if (movesFor(s.board, next).length) s.turn = next;
  else if (movesFor(s.board, s.turn).length) s.passed = next; // they can't move: same side again
  else {
    const you = count(s.board, s.you), them = count(s.board, -s.you as Color);
    const kind = you > them ? "win" : you < them ? "loss" : "draw";
    const points = kind === "win" ? WIN_PTS * s.level : kind === "draw" ? DRAW_PTS * s.level : 0;
    s.score += points;
    s.result = { kind, points, you, them };
  }
  return flips;
}

/** After a win or draw: the next game, colours swapped. */
export function nextGame(s: ReversiState) {
  if (!s.result || s.result.kind === "loss") return;
  if (s.result.kind === "win") s.level++;
  s.games++;
  Object.assign(s, startGame(s.games));
}
