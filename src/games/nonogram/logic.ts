/**
 * Nonogram rules and generator. Pure: no DOM, no clock. cell = row * n + col.
 * Pictures are random but clumped so they read as shapes. A puzzle is kept only if a line solver alone can finish
 * it from the clues, which also proves its solution is unique (no guessing ever needed).
 * Filling a blank or crossing a filled cell is a mistake (the cell is then shown right); three end the run.
 */
import type { Rng } from "@/engine/rng";

export const EMPTY = 0, FILL = 1, CROSS = 2;
export interface NonoState {
  n: number;
  solution: number[]; // 1 = filled
  marks: number[]; // EMPTY | FILL | CROSS
  rows: number[][];
  cols: number[][];
  mistakes: number;
  level: number;
  d?: number; // difficulty 0 Easy, 1 Medium, 2 Hard (missing = Medium)
  score: number;
  alive: boolean;
  solved: boolean;
}
export const MAX_MISTAKES = 3;
/** Mistakes allowed: 5 / 3 / 1. */
export const maxMistakes = (s: { d?: number }) => [5, 3, 1][s.d ?? 1];

export const sizeFor = (level: number) => (level <= 2 ? 5 : level <= 5 ? 8 : 10);
export const clueOf = (line: number[]) => {
  const out: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
};
const rowOf = (g: number[], n: number, r: number) => g.slice(r * n, r * n + n);
const colOf = (g: number[], n: number, c: number) => Array.from({ length: n }, (_, r) => g[r * n + c]);

/**
 * One line: from what's known (-1 unknown, 0 blank, 1 filled), what every arrangement of the clue agrees on.
 * Returns the line with newly forced cells, or null if no arrangement fits.
 */
export function solveLine(clue: number[], known: number[]): number[] | null {
  const n = known.length;
  let agree: number[] | null = null;
  const place = (k: number, from: number, line: number[]) => {
    if (k === clue.length) {
      for (let i = from; i < n; i++) if (known[i] === 1) return;
      const full = line.concat(Array(n - line.length).fill(0));
      agree = agree ? agree.map((v, i) => (v === full[i] ? v : -1)) : full;
      return;
    }
    const len = clue[k];
    const rest = clue.slice(k + 1).reduce((a, b) => a + b + 1, 0);
    for (let at = from; at + len + rest <= n; at++) {
      if (known.slice(from, at).includes(1)) break; // can't skip past a known filled cell
      if (known.slice(at, at + len).includes(0)) continue;
      if (at + len < n && known[at + len] === 1) continue;
      const seg = Array(at - from).fill(0).concat(Array(len).fill(1), at + len < n ? [0] : []);
      place(k + 1, Math.min(n, at + len + 1), line.concat(seg));
    }
  };
  place(0, 0, []);
  return agree;
}

/** Solve from clues by lines alone. Returns the grid (1/0) or null if it gets stuck or contradicts. */
export function lineSolve(rows: number[][], cols: number[][]): number[] | null {
  const n = rows.length;
  const g = Array(n * n).fill(-1);
  for (let changed = true; changed; ) {
    changed = false;
    for (let k = 0; k < 2 * n; k++) {
      const isRow = k < n, i = k % n;
      const known = isRow ? rowOf(g, n, i) : colOf(g, n, i);
      if (!known.includes(-1)) continue;
      const res = solveLine(isRow ? rows[i] : cols[i], known);
      if (!res) return null;
      res.forEach((v, j) => {
        const cell = isRow ? i * n + j : j * n + i;
        if (v !== -1 && g[cell] === -1) {
          g[cell] = v;
          changed = true;
        }
      });
    }
  }
  return g.includes(-1) ? null : g;
}

function puzzle(level: number, score: number, rng: Rng, d = 1): NonoState {
  const n = sizeFor(level);
  for (;;) {
    // Clumped noise: a few random seeds, grown into neighbours, so the picture has shape.
    let g = Array.from({ length: n * n }, () => (rng.next() < 0.5 ? 1 : 0));
    for (let pass = 0; pass < 2; pass++)
      g = g.map((_, i) => {
        const r = Math.floor(i / n), c = i % n;
        let on = 0, all = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
            all++;
            on += g[rr * n + cc];
          }
        return on * 2 > all || (on * 2 === all && rng.next() < 0.5) ? 1 : 0;
      });
    const filled = g.filter(Boolean).length;
    if (filled < n * n * 0.3 || filled > n * n * 0.75) continue;
    const rows = Array.from({ length: n }, (_, r) => clueOf(rowOf(g, n, r)));
    const cols = Array.from({ length: n }, (_, c) => clueOf(colOf(g, n, c)));
    if (lineSolve(rows, cols))
      return { n, solution: g, marks: Array(n * n).fill(EMPTY), rows, cols, mistakes: 0, level, score, alive: true, solved: false, d };
  }
}

export const newGame = (rng: Rng, d = 1) => puzzle(1, 0, rng, d);
export const nextPuzzle = (s: NonoState, rng: Rng) => Object.assign(s, puzzle(s.level + 1, s.score, rng, s.d ?? 1));

export type Marked = "ok" | "mistake" | "solved" | null;

/** Fill or cross a cell. A wrong call is a mistake and the cell shows its true state. */
export function mark(s: NonoState, cell: number, as: typeof FILL | typeof CROSS): Marked {
  if (!s.alive || s.solved || s.marks[cell] !== EMPTY) return null;
  const truth = s.solution[cell] ? FILL : CROSS;
  s.marks[cell] = truth;
  if (truth !== as) {
    s.mistakes++;
    if (s.mistakes >= maxMistakes(s)) s.alive = false;
    return "mistake";
  }
  if (as === FILL) s.score += 2 * s.level;
  if (s.solution.every((v, i) => !v || s.marks[i] === FILL)) {
    s.solved = true;
    s.score += 150 * s.level - 30 * s.mistakes;
    s.marks = s.marks.map((m, i) => (s.solution[i] ? FILL : m === EMPTY ? CROSS : m));
    return "solved";
  }
  return "ok";
}

/** A line is done when every filled cell of its answer is filled. */
export function lineDone(s: NonoState, isRow: boolean, i: number) {
  const idx = Array.from({ length: s.n }, (_, j) => (isRow ? i * s.n + j : j * s.n + i));
  return idx.every((c) => !s.solution[c] || s.marks[c] === FILL);
}
