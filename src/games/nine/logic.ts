/**
 * Nine (sudoku) rules and generator. Pure: no DOM, no clock. cell = row * 9 + col, 0 = empty.
 * Generator: fill a random full grid, then remove clues one by one, keeping a removal only if the
 * puzzle still has exactly one solution. Grading: "Gentle" if naked + hidden singles alone solve it.
 * A wrong number counts as a mistake; three mistakes end the run. Solving moves you to a harder puzzle.
 */
import type { Rng } from "@/engine/rng";

export interface NineState {
  givens: number[]; // the puzzle's clues
  grid: number[]; // clues + your numbers
  solution: number[];
  notes: number[]; // bitmask of pencil marks (bit d = digit d)
  grade: "Gentle" | "Tricky";
  mistakes: number;
  level: number;
  score: number;
  alive: boolean;
  solved: boolean;
}
export const MAX_MISTAKES = 3;

const ROW = (i: number) => Math.floor(i / 9);
const COL = (i: number) => i % 9;
const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
/** Cells sharing a row, column or box with i (not i itself). */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter((j) => j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))),
);
const ALL = 0b1111111110;
const candidates = (g: number[], i: number) => PEERS[i].reduce((m, j) => m & ~(1 << g[j]), ALL);
const bits = (m: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & (1 << d));

/** Number of solutions, stopping at `limit`. Fills `g` with the first one found if `keep`. */
export function countSolutions(grid: number[], limit = 2, order?: (ds: number[]) => number[]): { count: number; first: number[] | null } {
  const g = grid.slice();
  let count = 0;
  let first: number[] | null = null;
  const go = (): boolean => {
    let best = -1, bestM = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = candidates(g, i);
      const n = bits(m).length;
      if (n < bestN) {
        best = i;
        bestM = m;
        bestN = n;
        if (n <= 1) break;
      }
    }
    if (best < 0) {
      count++;
      first ??= g.slice();
      return count >= limit;
    }
    for (const d of order ? order(bits(bestM)) : bits(bestM)) {
      g[best] = d;
      if (go()) return true;
    }
    g[best] = 0;
    return false;
  };
  go();
  return { count, first };
}

/** Can it be solved with naked and hidden singles alone? */
export function singlesSolve(grid: number[]): boolean {
  const g = grid.slice();
  for (let progress = true; progress; ) {
    progress = false;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const c = bits(candidates(g, i));
      if (!c.length) return false;
      if (c.length === 1) {
        g[i] = c[0];
        progress = true;
      }
    }
    // Hidden singles: a digit with one possible home in a unit.
    for (let u = 0; u < 27; u++) {
      const cells = Array.from({ length: 81 }, (_, i) => i).filter((i) => (u < 9 ? ROW(i) === u : u < 18 ? COL(i) === u - 9 : BOX(i) === u - 18));
      for (let d = 1; d <= 9; d++) {
        if (cells.some((i) => g[i] === d)) continue;
        const homes = cells.filter((i) => !g[i] && candidates(g, i) & (1 << d));
        if (homes.length === 1) {
          g[homes[0]] = d;
          progress = true;
        }
      }
    }
  }
  return g.every(Boolean);
}

const cluesFor = (level: number) => Math.max(26, 42 - level * 2);

function puzzle(level: number, score: number, rng: Rng): NineState {
  const shuffle = <T,>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const solution = countSolutions(Array(81).fill(0), 1, (ds) => shuffle(ds.slice())).first!;
  const givens = solution.slice();
  let clues = 81;
  for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k))) {
    if (clues <= cluesFor(level)) break;
    const v = givens[i];
    givens[i] = 0;
    if (countSolutions(givens, 2).count === 1) clues--;
    else givens[i] = v; // that clue was holding the answer in place
  }
  return {
    givens, grid: givens.slice(), solution, notes: Array(81).fill(0), grade: singlesSolve(givens) ? "Gentle" : "Tricky",
    mistakes: 0, level, score, alive: true, solved: false,
  };
}

export const newGame = (rng: Rng) => puzzle(1, 0, rng);
export const nextPuzzle = (s: NineState, rng: Rng) => Object.assign(s, puzzle(s.level + 1, s.score, rng));

export type Placed = "right" | "wrong" | "solved" | null;

/** Put digit d in a cell. Right numbers score and clear that digit from peers' notes; wrong ones are mistakes. */
export function place(s: NineState, cell: number, d: number): Placed {
  if (!s.alive || s.solved || s.givens[cell] || s.grid[cell] === s.solution[cell] || d < 1 || d > 9) return null;
  if (s.solution[cell] !== d) {
    s.mistakes++;
    if (s.mistakes >= MAX_MISTAKES) s.alive = false;
    return "wrong";
  }
  s.grid[cell] = d;
  s.notes[cell] = 0;
  for (const j of PEERS[cell]) s.notes[j] &= ~(1 << d);
  s.score += 5 * s.level;
  if (s.grid.every((v, i) => v === s.solution[i])) {
    s.solved = true;
    s.score += (s.grade === "Tricky" ? 400 : 250) * s.level - 50 * s.mistakes;
    return "solved";
  }
  return "right";
}

export function toggleNote(s: NineState, cell: number, d: number): boolean {
  if (!s.alive || s.solved || s.grid[cell] || d < 1 || d > 9) return false;
  s.notes[cell] ^= 1 << d;
  return true;
}

export const conflicts = (g: number[], cell: number) => g[cell] !== 0 && PEERS[cell].some((j) => g[j] === g[cell]);
