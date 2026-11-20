/**
 * Lights Out rules. Pure: no DOM, no clock. Pressing a cell flips it and its four neighbours; turn every light off.
 * Puzzles are made by pressing random cells on a dark board, so each one is solvable. A solver over GF(2)
 * (Gaussian elimination, then the lightest of the equivalent solutions) gives the true minimum: the level's par.
 * Each level allows par + a little slack; running out of moves ends the run.
 */
import type { Rng } from "@/engine/rng";

export interface LightsState {
  n: number;
  lights: number[]; // 1 = on
  par: number;
  movesLeft: number;
  level: number;
  score: number;
  alive: boolean;
  solved: boolean;
}

export const sizeFor = (level: number) => (level <= 3 ? 5 : level <= 6 ? 6 : 7);
const slackFor = (level: number) => Math.max(2, 5 - Math.floor(level / 3));

export function press(lights: number[], n: number, cell: number) {
  const r = Math.floor(cell / n), c = cell % n;
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) lights[rr * n + cc] ^= 1;
  }
}

/** The fewest presses that turn every light off (cells to press), or null if unsolvable. */
export function solve(lights: number[], n: number): number[] | null {
  const N = n * n;
  // Row j: which presses flip cell j, augmented with the cell's light.
  const rows = Array.from({ length: N }, (_, j) => {
    const row = Array(N + 1).fill(0);
    const effect = Array(N).fill(0);
    press(effect, n, j); // pressing j flips the same cells that flip j (the relation is symmetric)
    effect.forEach((v, i) => (row[i] = v));
    row[N] = lights[j];
    return row;
  });
  const pivotCol: number[] = [];
  let r = 0;
  for (let col = 0; col < N && r < N; col++) {
    const p = rows.findIndex((row, i) => i >= r && row[col]);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let i = 0; i < N; i++) if (i !== r && rows[i][col]) for (let k = col; k <= N; k++) rows[i][k] ^= rows[r][k];
    pivotCol.push(col);
    r++;
  }
  if (rows.slice(r).some((row) => row[N])) return null;
  const free = Array.from({ length: N }, (_, i) => i).filter((i) => !pivotCol.includes(i));
  let best: number[] | null = null;
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const x = Array(N).fill(0);
    free.forEach((f, k) => (x[f] = (mask >> k) & 1));
    pivotCol.forEach((col, i) => {
      let v = rows[i][N];
      for (const f of free) if (rows[i][f]) v ^= x[f];
      x[col] = v;
    });
    const cells = x.flatMap((v, i) => (v ? [i] : []));
    if (!best || cells.length < best.length) best = cells;
  }
  return best;
}

function level(levelNo: number, score: number, rng: Rng): LightsState {
  const n = sizeFor(levelNo);
  const want = Math.min(n * n - 4, 3 + levelNo);
  for (;;) {
    const lights = Array(n * n).fill(0);
    const cells = Array.from({ length: n * n }, (_, i) => i);
    for (let k = 0; k < want; k++) press(lights, n, cells.splice(rng.int(0, cells.length - 1), 1)[0]);
    const par = solve(lights, n)!.length;
    if (par >= Math.min(want, 3)) return { n, lights, par, movesLeft: par + slackFor(levelNo), level: levelNo, score, alive: true, solved: false };
  }
}

export const newGame = (rng: Rng) => level(1, 0, rng);
export const nextLevel = (s: LightsState, rng: Rng) => Object.assign(s, level(s.level + 1, s.score, rng));

/** Press a cell: flips it and its neighbours, spends a move, settles solved / out of moves. */
export function tap(s: LightsState, cell: number): boolean {
  if (!s.alive || s.solved || cell < 0 || cell >= s.n * s.n) return false;
  press(s.lights, s.n, cell);
  s.movesLeft--;
  if (s.lights.every((v) => !v)) {
    s.solved = true;
    s.score += 50 * s.level + 20 * s.movesLeft;
  } else if (s.movesLeft <= 0) s.alive = false;
  return true;
}
