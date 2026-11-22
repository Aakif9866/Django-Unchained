/**
 * Twenty48 rules. Pure: no DOM, no clock. A 4 × 4 board (cell = row * 4 + col); 0 is empty.
 * A move slides every tile toward one edge, merging equal neighbours once, then spawns a 2 (90%) or 4.
 * Undo steps back one move and rewinds the random generator too, so it can't be used to fish for a better spawn.
 */
import type { Rng } from "@/engine/rng";

export type Dir = "up" | "down" | "left" | "right";
export const SIZE = 4;
export const GOAL = 2048;

interface Snap {
  board: number[];
  score: number;
  moves: number;
  won: boolean;
  rng: number;
}
export interface T48State extends Omit<Snap, "rng"> {
  over: boolean;
  undo: Snap | null;
  d?: number; // difficulty 0 Easy, 1 Medium, 2 Hard (missing = Medium)
}
export interface Moved {
  slides: { from: number; to: number }[];
  merges: number[]; // cells holding a freshly merged tile
  spawn: number; // cell of the new tile
  gained: number;
  reachedGoal: boolean;
}

// For each direction: the four lines, each listed from the edge the tiles move toward.
const idx = (r: number, c: number) => r * SIZE + c;
const range = [0, 1, 2, 3];
const LINES: Record<Dir, number[][]> = {
  left: range.map((r) => range.map((c) => idx(r, c))),
  right: range.map((r) => range.map((c) => idx(r, SIZE - 1 - c))),
  up: range.map((c) => range.map((r) => idx(r, c))),
  down: range.map((c) => range.map((r) => idx(SIZE - 1 - r, c))),
};

const P4 = [0.05, 0.1, 0.25]; // chance a new tile is a 4
function spawn(board: number[], rng: Rng, p4 = 0.1): number {
  const empty = board.flatMap((v, i) => (v ? [] : [i]));
  if (!empty.length) return -1;
  const at = rng.pick(empty);
  board[at] = rng.next() < 1 - p4 ? 2 : 4;
  return at;
}

export function canMove(board: number[]): boolean {
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (!board[i]) return true;
    if (i % SIZE < SIZE - 1 && board[i] === board[i + 1]) return true;
    if (i < SIZE * (SIZE - 1) && board[i] === board[i + SIZE]) return true;
  }
  return false;
}

export function newGame(rng: Rng, d = 1): T48State {
  const board = Array(SIZE * SIZE).fill(0);
  spawn(board, rng, P4[d]);
  spawn(board, rng, P4[d]);
  return { board, score: 0, moves: 0, won: false, over: false, undo: null, d };
}

/** Slide toward `dir`. Returns what happened (for animation), or null if nothing could move. */
export function move(s: T48State, dir: Dir, rng: Rng): Moved | null {
  if (s.over) return null;
  const next = Array(SIZE * SIZE).fill(0);
  const slides: Moved["slides"] = [];
  const merges: number[] = [];
  let gained = 0;
  for (const line of LINES[dir]) {
    let t = 0; // next free slot in this line
    let open = -1; // slot holding an unmerged tile that the next equal tile may join
    for (const from of line) {
      const v = s.board[from];
      if (!v) continue;
      if (open >= 0 && next[line[open]] === v) {
        next[line[open]] = v * 2;
        gained += v * 2;
        merges.push(line[open]);
        slides.push({ from, to: line[open] });
        open = -1; // a tile merges once per move
      } else {
        next[line[t]] = v;
        slides.push({ from, to: line[t] });
        open = t++;
      }
    }
  }
  if (!merges.length && slides.every((m) => m.from === m.to)) return null;
  s.undo = { board: s.board, score: s.score, moves: s.moves, won: s.won, rng: rng.state() };
  s.board = next;
  s.score += gained;
  s.moves++;
  const reachedGoal = !s.won && next.some((v) => v >= GOAL);
  if (reachedGoal) s.won = true; // you can keep going past it
  const at = spawn(next, rng, P4[s.d ?? 1]);
  s.over = !canMove(next);
  return { slides, merges, spawn: at, gained, reachedGoal };
}

/** Step back one move (once). Rewinds the generator, so replaying the same move spawns the same tile. */
export function undo(s: T48State, rng: Rng): boolean {
  const u = s.undo;
  if (!u || s.over || s.d === 2) return false; // Hard: no undo
  Object.assign(s, { board: u.board, score: u.score, moves: u.moves, won: u.won, undo: null });
  rng.setState(u.rng);
  return true;
}

export const maxTile = (board: number[]) => Math.max(...board);
