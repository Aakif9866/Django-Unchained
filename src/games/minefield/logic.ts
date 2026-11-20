/**
 * Minefield rules. Pure: no DOM, no clock. cell = row * cols + col.
 * Mines are laid on the first dig, never on or next to it, so every board opens with a free area.
 * A run is a series of boards that grow and get denser; one mine ends it.
 */
import type { Rng } from "@/engine/rng";

export const CLOSED = 0, OPEN = 1, FLAG = 2;
export interface MineState {
  cols: number;
  rows: number;
  count: number; // mines on this board
  mines: number[] | null; // 1 = mine; null until the first dig
  marks: number[]; // CLOSED | OPEN | FLAG per cell
  level: number;
  score: number;
  alive: boolean;
  boom: number; // the mine that went off, or -1
  cleared: boolean; // every safe cell open: waiting for the next board
}

export function sizeFor(level: number) {
  const cols = 8;
  const rows = Math.min(14, 9 + level);
  const count = Math.round(cols * rows * Math.min(0.2, 0.11 + 0.015 * level));
  return { cols, rows, count };
}

function board(level: number, score: number): MineState {
  const { cols, rows, count } = sizeFor(level);
  return { cols, rows, count, mines: null, marks: Array(cols * rows).fill(CLOSED), level, score, alive: true, boom: -1, cleared: false };
}
export const newGame = () => board(1, 0);
/** After clearing a board: the next, bigger one. */
export const nextBoard = (s: MineState) => Object.assign(s, board(s.level + 1, s.score));

export function neighbours(s: Pick<MineState, "cols" | "rows">, cell: number): number[] {
  const r = Math.floor(cell / s.cols), c = cell % s.cols, out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < s.rows && cc >= 0 && cc < s.cols) out.push(rr * s.cols + cc);
    }
  return out;
}
export const minesAround = (s: MineState, cell: number) => (s.mines ? neighbours(s, cell).reduce((n, i) => n + s.mines![i], 0) : 0);
export const flagsAround = (s: MineState, cell: number) => neighbours(s, cell).filter((i) => s.marks[i] === FLAG).length;

function lay(s: MineState, first: number, rng: Rng) {
  const keep = new Set([first, ...neighbours(s, first)]);
  const spots = s.marks.map((_, i) => i).filter((i) => !keep.has(i));
  const mines = Array(s.cols * s.rows).fill(0);
  for (let k = 0; k < s.count && spots.length; k++) mines[spots.splice(rng.int(0, spots.length - 1), 1)[0]] = 1;
  s.mines = mines;
}

export interface Dug {
  opened: { cell: number; ring: number }[]; // ring = flood distance, for a ripple
  boom: boolean;
  cleared: boolean;
}

/** Dig a cell (or, on an open number with enough flags around it, everything else around it). */
export function dig(s: MineState, cell: number, rng: Rng): Dug {
  const out: Dug = { opened: [], boom: false, cleared: false };
  if (!s.alive || s.cleared || s.marks[cell] === FLAG) return out;
  if (!s.mines) lay(s, cell, rng);
  const mines = s.mines!;
  let starts: number[];
  if (s.marks[cell] === OPEN) {
    const n = minesAround(s, cell);
    if (!n || flagsAround(s, cell) !== n) return out; // chord only when the flags add up
    starts = neighbours(s, cell).filter((i) => s.marks[i] === CLOSED);
  } else starts = [cell];
  const hit = starts.find((i) => mines[i]);
  if (hit !== undefined) {
    s.alive = false;
    s.boom = hit;
    out.boom = true;
    return out;
  }
  // Flood: zeros open everything around them.
  let ring = 0;
  let wave = starts;
  for (const i of wave) s.marks[i] = OPEN;
  while (wave.length) {
    const next: number[] = [];
    for (const i of wave) {
      out.opened.push({ cell: i, ring });
      if (minesAround(s, i) === 0)
        for (const j of neighbours(s, i))
          if (s.marks[j] === CLOSED) {
            s.marks[j] = OPEN;
            next.push(j);
          }
    }
    wave = next;
    ring++;
  }
  s.score += out.opened.length * s.level;
  if (s.marks.every((m, i) => mines[i] || m === OPEN)) {
    s.cleared = out.cleared = true;
    s.score += 100 * s.level;
    s.marks = s.marks.map((m, i) => (mines[i] ? FLAG : m)); // show every mine as flagged
  }
  return out;
}

export function flag(s: MineState, cell: number): boolean {
  if (!s.alive || s.cleared || s.marks[cell] === OPEN) return false;
  s.marks[cell] = s.marks[cell] === FLAG ? CLOSED : FLAG;
  return true;
}

export const flagsLeft = (s: MineState) => s.count - s.marks.filter((m) => m === FLAG).length;
