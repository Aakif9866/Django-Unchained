/**
 * Stack Fall rules. Pure: no DOM, no clock.
 * Super Rotation System (box rotation + wall-kick tables), 7-bag randomiser, hold, ghost,
 * lock delay with move-reset, guideline gravity and scoring. Board is 10×22; the top 2 rows are hidden.
 */
import type { Rng } from "@/engine/rng";

export type Kind = "I" | "J" | "L" | "O" | "S" | "T" | "Z";
export const KINDS: Kind[] = ["I", "J", "L", "O", "S", "T", "Z"];
export const COLS = 10;
export const ROWS = 22;
export const HIDDEN = 2;
export const LOCK_DELAY = 0.5;
export const MAX_RESETS = 15;
export const PREVIEW = 3;

export interface Piece {
  k: Kind;
  r: number; // 0..3
  x: number; // box origin
  y: number;
}
export interface StackState {
  board: number[]; // ROWS*COLS, 0 = empty, else 1 + KINDS index
  cur: Piece;
  bag: Kind[]; // upcoming pieces (always ≥ PREVIEW)
  hold: Kind | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  start?: number; // starting level, by difficulty (missing = 1)
  grav: number; // seconds accumulated toward the next gravity step
  lock: number; // seconds resting on the stack
  resets: number;
  alive: boolean;
}
export type Clear = { rows: number[]; points: number };

type Cell = readonly [number, number];
const SPAWN: Record<Kind, { size: number; cells: Cell[] }> = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
};

/** SRS true rotation = rotating clockwise inside the piece's bounding box. Precomputed per kind and state. */
const SHAPES = Object.fromEntries(
  KINDS.map((k) => {
    const { size, cells } = SPAWN[k];
    const states: Cell[][] = [cells];
    for (let i = 1; i < 4; i++) states.push(states[i - 1].map(([x, y]) => [size - 1 - y, x] as const));
    return [k, states];
  }),
) as Record<Kind, Cell[][]>;

// Wall kicks, written y-up as in the SRS spec; converted to y-down where used.
const KICK_JLSTZ: Record<string, Cell[]> = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICK_I: Record<string, Cell[]> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

export const cellsOf = (p: Piece) => SHAPES[p.k][p.r].map(([x, y]) => [p.x + x, p.y + y] as const);

/** Gravity interval in seconds (guideline curve), floored so high levels stay humanly playable. */
export const gravity = (level: number) => Math.max(0.03, (0.8 - (level - 1) * 0.007) ** (level - 1));
export const LINE_POINTS = [0, 100, 300, 500, 800];

export function fits(board: number[], p: Piece): boolean {
  return cellsOf(p).every(([x, y]) => x >= 0 && x < COLS && y >= 0 && y < ROWS && board[y * COLS + x] === 0);
}

function refill(s: StackState, rng: Rng) {
  while (s.bag.length <= PREVIEW + 1) {
    const b = [...KINDS];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    s.bag.push(...b);
  }
}

const spawnPiece = (k: Kind): Piece => ({ k, r: 0, x: k === "O" ? 4 : 3, y: 1 });

function enter(s: StackState, k: Kind) {
  s.cur = spawnPiece(k);
  s.grav = 0;
  s.lock = 0;
  s.resets = 0;
  if (!fits(s.board, s.cur)) s.alive = false; // block out
}

export function newGame(rng: Rng, start = 1): StackState {
  const s: StackState = {
    board: Array(ROWS * COLS).fill(0), cur: spawnPiece("T"), bag: [], hold: null, canHold: true,
    score: 0, lines: 0, level: start, start, grav: 0, lock: 0, resets: 0, alive: true,
  };
  refill(s, rng);
  enter(s, s.bag.shift()!);
  refill(s, rng);
  return s;
}

const grounded = (s: StackState) => !fits(s.board, { ...s.cur, y: s.cur.y + 1 });

/** Any successful move/rotate while grounded restarts the lock timer, at most MAX_RESETS times per piece. */
function moved(s: StackState) {
  if (grounded(s) && s.resets < MAX_RESETS) {
    s.lock = 0;
    s.resets++;
  }
}

export function shift(s: StackState, dx: number): boolean {
  if (!s.alive) return false;
  const p = { ...s.cur, x: s.cur.x + dx };
  if (!fits(s.board, p)) return false;
  s.cur = p;
  moved(s);
  return true;
}

export function rotate(s: StackState, dir: 1 | -1 = 1): boolean {
  if (!s.alive || s.cur.k === "O") return false;
  const to = (s.cur.r + dir + 4) % 4;
  const table = s.cur.k === "I" ? KICK_I : KICK_JLSTZ;
  for (const [kx, ky] of table[`${s.cur.r}>${to}`]) {
    const p = { ...s.cur, r: to, x: s.cur.x + kx, y: s.cur.y - ky };
    if (fits(s.board, p)) {
      s.cur = p;
      moved(s);
      return true;
    }
  }
  return false;
}

export function ghostY(s: StackState): number {
  let y = s.cur.y;
  while (fits(s.board, { ...s.cur, y: y + 1 })) y++;
  return y;
}

export function hold(s: StackState, rng: Rng): boolean {
  if (!s.alive || !s.canHold) return false;
  const k = s.cur.k;
  if (s.hold) enter(s, s.hold);
  else {
    enter(s, s.bag.shift()!);
    refill(s, rng);
  }
  s.hold = k;
  s.canHold = false;
  return true;
}

function lockPiece(s: StackState, rng: Rng): Clear {
  const cells = cellsOf(s.cur);
  for (const [x, y] of cells) s.board[y * COLS + x] = KINDS.indexOf(s.cur.k) + 1;
  if (cells.every(([, y]) => y < HIDDEN)) {
    s.alive = false; // lock out: landed entirely above the visible field
    return { rows: [], points: 0 };
  }
  const rows: number[] = [];
  for (let y = 0; y < ROWS; y++) if (s.board.slice(y * COLS, y * COLS + COLS).every((c) => c)) rows.push(y);
  for (const y of rows) {
    s.board.splice(y * COLS, COLS);
    s.board.unshift(...Array(COLS).fill(0));
  }
  const points = LINE_POINTS[rows.length] * s.level;
  s.score += points;
  s.lines += rows.length;
  s.level = (s.start ?? 1) + Math.floor(s.lines / 10);
  s.canHold = true;
  enter(s, s.bag.shift()!);
  refill(s, rng);
  return { rows, points };
}

export function softDrop(s: StackState): boolean {
  if (!s.alive || grounded(s)) return false;
  s.cur = { ...s.cur, y: s.cur.y + 1 };
  s.grav = 0;
  s.score += 1;
  return true;
}

export function hardDrop(s: StackState, rng: Rng): Clear {
  if (!s.alive) return { rows: [], points: 0 };
  const y = ghostY(s);
  s.score += (y - s.cur.y) * 2;
  s.cur = { ...s.cur, y };
  return lockPiece(s, rng);
}

/** Advance time. Returns a Clear when a piece locked this step (rows may be empty), else null. */
export function step(s: StackState, dt: number, rng: Rng): Clear | null {
  if (!s.alive) return null;
  if (grounded(s)) {
    s.grav = 0;
    s.lock += dt;
    if (s.lock >= LOCK_DELAY) return lockPiece(s, rng);
    return null;
  }
  s.lock = 0;
  s.grav += dt;
  const g = gravity(s.level);
  while (s.grav >= g && !grounded(s)) {
    s.grav -= g;
    s.cur = { ...s.cur, y: s.cur.y + 1 };
  }
  return null;
}
