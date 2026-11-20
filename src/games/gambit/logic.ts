/**
 * Gambit rules and engine. Pure: no DOM, no clock.
 * Board: 64 squares, a8 = 0 … h1 = 63. Pieces are signed: +1..+6 = white P N B R Q K, negative = black, 0 = empty.
 * Moves are numbers: from | to << 6 | promo << 12. Move generation is perft-tested against known node counts.
 * A run is a ladder of games: a win moves you up a level (a stronger engine), a draw scores and stays, a loss ends it.
 */
import type { Rng } from "@/engine/rng";
import { WIN, search, type Position } from "../search";

export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
export type Color = 1 | -1;

export interface Pos {
  board: number[];
  turn: Color;
  castle: number; // 1 = white O-O, 2 = white O-O-O, 4 = black O-O, 8 = black O-O-O
  ep: number; // en-passant target square, or -1
  half: number; // plies since the last capture or pawn move (50-move rule)
  full: number;
}

export type End = "mate" | "stalemate" | "fifty" | "repetition" | "material";
export interface GambitState {
  pos: Pos;
  keys: string[]; // positions since the last capture or pawn move, for threefold repetition
  you: Color;
  level: number; // 1 + games won
  games: number; // games finished; colours alternate
  score: number;
  last: number; // last move, or -1
  ply: number; // moves played this game
  result: null | { kind: "win" | "loss" | "draw"; why: End | "resign"; points: number };
}

export const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const VALUE = [0, 100, 320, 330, 500, 900, 0];
const CAPTURE_PTS = [0, 10, 30, 30, 50, 90, 0];
export const WIN_PTS = 300;
export const DRAW_PTS = 100;

export const moveOf = (from: number, to: number, promo = 0) => from | (to << 6) | (promo << 12);
export const fromOf = (m: number) => m & 63;
export const toOf = (m: number) => (m >> 6) & 63;
export const promoOf = (m: number) => m >> 12;
export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => 7 - (sq >> 3); // 0 = rank 1
export const sqOf = (name: string) => (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97);
export const nameOf = (sq: number) => String.fromCharCode(97 + fileOf(sq)) + (rankOf(sq) + 1);

// Precomputed targets, so generation never tests board edges.
const KNIGHT: number[][] = [];
const KING: number[][] = [];
const RAYS: number[][][] = []; // RAYS[sq][d]: d 0–3 orthogonal, 4–7 diagonal
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
for (let sq = 0; sq < 64; sq++) {
  const f = fileOf(sq), r = rankOf(sq);
  const at = (ff: number, rr: number) => (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 ? (7 - rr) * 8 + ff : -1);
  KNIGHT[sq] = JUMPS.map(([a, b]) => at(f + a, r + b)).filter((t) => t >= 0);
  KING[sq] = DIRS.map(([a, b]) => at(f + a, r + b)).filter((t) => t >= 0);
  RAYS[sq] = DIRS.map(([a, b]) => {
    const ray: number[] = [];
    for (let k = 1, t = at(f + a, r + b); t >= 0; k++, t = at(f + a * k, r + b * k)) ray.push(t);
    return ray;
  });
}
// Moving from or to these squares drops castling rights (king or rook moved, or rook captured).
const CASTLE_KEEP = Array(64).fill(15);
CASTLE_KEEP[63] = 15 & ~1;
CASTLE_KEEP[56] = 15 & ~2;
CASTLE_KEEP[60] = 15 & ~3;
CASTLE_KEEP[7] = 15 & ~4;
CASTLE_KEEP[0] = 15 & ~8;
CASTLE_KEEP[4] = 15 & ~12;

const LETTERS = " pnbrqk";
export function fromFen(fen: string): Pos {
  const [rows, turn, cas, ep, half = "0", full = "1"] = fen.trim().split(/\s+/);
  const board: number[] = [];
  for (const ch of rows.replace(/\//g, "")) {
    if (ch >= "1" && ch <= "8") for (let i = 0; i < Number(ch); i++) board.push(0);
    else board.push(LETTERS.indexOf(ch.toLowerCase()) * (ch === ch.toLowerCase() ? -1 : 1));
  }
  const castle = (cas.includes("K") ? 1 : 0) | (cas.includes("Q") ? 2 : 0) | (cas.includes("k") ? 4 : 0) | (cas.includes("q") ? 8 : 0);
  return { board, turn: turn === "w" ? 1 : -1, castle, ep: ep === "-" ? -1 : sqOf(ep), half: Number(half), full: Number(full) };
}

const KEY_CHARS = "kqrbnp.PNBRQK";
export const keyOf = (p: Pos) => p.board.map((v) => KEY_CHARS[v + 6]).join("") + p.turn + p.castle + p.ep;

export function attacked(b: number[], sq: number, by: Color): boolean {
  const f = fileOf(sq);
  if (by === 1) {
    if (f < 7 && b[sq + 9] === P) return true;
    if (f > 0 && b[sq + 7] === P) return true;
  } else {
    if (f < 7 && b[sq - 7] === -P) return true;
    if (f > 0 && b[sq - 9] === -P) return true;
  }
  for (const t of KNIGHT[sq]) if (b[t] === N * by) return true;
  for (const t of KING[sq]) if (b[t] === K * by) return true;
  const rays = RAYS[sq];
  for (let d = 0; d < 8; d++) {
    for (const t of rays[d]) {
      const v = b[t] * by;
      if (!v) continue;
      if (v === Q || v === (d < 4 ? R : B)) return true;
      break;
    }
  }
  return false;
}

export const kingSq = (b: number[], c: Color) => b.indexOf(K * c);
export const inCheck = (p: Pos, c: Color = p.turn) => attacked(p.board, kingSq(p.board, c), -c as Color);

/** Pseudo-legal moves (may leave the king in check). `caps` = captures and promotions only. */
function gen(p: Pos, caps: boolean): number[] {
  const b = p.board, us = p.turn, out: number[] = [];
  const pawnTo = (from: number, to: number) => {
    if (to < 8 || to >= 56) for (const pr of [Q, N, R, B]) out.push(moveOf(from, to, pr));
    else out.push(moveOf(from, to));
  };
  for (let sq = 0; sq < 64; sq++) {
    const v = b[sq] * us;
    if (v <= 0) continue;
    if (v === P) {
      const fwd = us === 1 ? -8 : 8;
      const to = sq + fwd;
      const promo = to < 8 || to >= 56;
      if (!b[to] && (!caps || promo)) {
        pawnTo(sq, to);
        const home = us === 1 ? sq >= 48 : sq < 16;
        if (!caps && home && !b[to + fwd]) out.push(moveOf(sq, to + fwd));
      }
      const f = fileOf(sq);
      if (f > 0 && (b[to - 1] * us < 0 || to - 1 === p.ep)) pawnTo(sq, to - 1);
      if (f < 7 && (b[to + 1] * us < 0 || to + 1 === p.ep)) pawnTo(sq, to + 1);
    } else if (v === N || v === K) {
      for (const t of (v === N ? KNIGHT : KING)[sq]) {
        const w = b[t] * us;
        if (w < 0 || (w === 0 && !caps)) out.push(moveOf(sq, t));
      }
    } else {
      const d1 = v === R ? 4 : 8;
      for (let d = v === B ? 4 : 0; d < d1; d++) {
        for (const t of RAYS[sq][d]) {
          const w = b[t] * us;
          if (w === 0) {
            if (!caps) out.push(moveOf(sq, t));
            continue;
          }
          if (w < 0) out.push(moveOf(sq, t));
          break;
        }
      }
    }
  }
  const e = us === 1 ? 60 : 4;
  if (!caps && b[e] === K * us) {
    // Castling: rights, empty squares between, and the king never passes through or starts in check.
    const them = -us as Color;
    const [ks, qs] = us === 1 ? [1, 2] : [4, 8];
    if (p.castle & ks && !b[e + 1] && !b[e + 2] && b[e + 3] === R * us && !attacked(b, e, them) && !attacked(b, e + 1, them) && !attacked(b, e + 2, them))
      out.push(moveOf(e, e + 2));
    if (p.castle & qs && !b[e - 1] && !b[e - 2] && !b[e - 3] && b[e - 4] === R * us && !attacked(b, e, them) && !attacked(b, e - 1, them) && !attacked(b, e - 2, them))
      out.push(moveOf(e, e - 2));
  }
  return out;
}

export interface Undo {
  cap: number;
  capSq: number;
  castle: number;
  ep: number;
  half: number;
}

export function make(p: Pos, m: number): Undo {
  const b = p.board, from = fromOf(m), to = toOf(m), promo = promoOf(m);
  const piece = b[from], type = Math.abs(piece), us = p.turn;
  const capSq = type === P && to === p.ep ? to + (us === 1 ? 8 : -8) : to; // en passant takes the pawn behind
  const u: Undo = { cap: b[capSq], capSq, castle: p.castle, ep: p.ep, half: p.half };
  b[capSq] = 0;
  b[to] = promo ? promo * us : piece;
  b[from] = 0;
  if (type === K && Math.abs(to - from) === 2) {
    const [rf, rt] = to > from ? [to + 1, to - 1] : [to - 2, to + 1];
    b[rt] = b[rf];
    b[rf] = 0;
  }
  p.castle &= CASTLE_KEEP[from] & CASTLE_KEEP[to];
  p.ep = type === P && Math.abs(to - from) === 16 ? (from + to) >> 1 : -1;
  p.half = type === P || u.cap ? 0 : p.half + 1;
  if (us === -1) p.full++;
  p.turn = -us as Color;
  return u;
}

export function unmake(p: Pos, m: number, u: Undo) {
  const b = p.board, from = fromOf(m), to = toOf(m);
  const us = (p.turn = -p.turn as Color);
  if (us === -1) p.full--;
  const piece = promoOf(m) ? P * us : b[to];
  b[from] = piece;
  b[to] = 0;
  b[u.capSq] = u.cap;
  if (Math.abs(piece) === K && Math.abs(to - from) === 2) {
    const [rf, rt] = to > from ? [to + 1, to - 1] : [to - 2, to + 1];
    b[rf] = b[rt];
    b[rt] = 0;
  }
  p.castle = u.castle;
  p.ep = u.ep;
  p.half = u.half;
}

const isLegal = (p: Pos, m: number) => {
  const us = p.turn;
  const u = make(p, m);
  const ok = !inCheck(p, us);
  unmake(p, m, u);
  return ok;
};
export const legalMoves = (p: Pos, caps = false) => gen(p, caps).filter((m) => isLegal(p, m));
const anyLegal = (p: Pos) => gen(p, false).some((m) => isLegal(p, m));

export function perft(p: Pos, depth: number): number {
  const ms = legalMoves(p);
  if (depth <= 1) return depth === 1 ? ms.length : 1;
  let n = 0;
  for (const m of ms) {
    const u = make(p, m);
    n += perft(p, depth - 1);
    unmake(p, m, u);
  }
  return n;
}

/** Type of the piece a move captures (en passant included), or 0. */
export function capturedBy(p: Pos, m: number): number {
  const v = p.board[toOf(m)];
  if (v) return Math.abs(v);
  return Math.abs(p.board[fromOf(m)]) === P && toOf(m) === p.ep ? P : 0;
}

export function insufficient(b: number[]): boolean {
  let minors = 0, knights = 0;
  const shades = new Set<number>();
  for (let sq = 0; sq < 64; sq++) {
    const t = Math.abs(b[sq]);
    if (t === P || t === R || t === Q) return false;
    if (t === N) knights++;
    if (t === B) shades.add((fileOf(sq) + (sq >> 3)) & 1);
    if (t === N || t === B) minors++;
  }
  return minors <= 1 || (knights === 0 && shades.size === 1);
}

export function ending(p: Pos, keys: string[]): End | null {
  if (!anyLegal(p)) return inCheck(p) ? "mate" : "stalemate";
  if (p.half >= 100) return "fifty";
  const k = keyOf(p);
  if (keys.filter((x) => x === k).length >= 3) return "repetition";
  if (insufficient(p.board)) return "material";
  return null;
}

// ---------- Evaluation (centipawns, side to move) ----------

// Piece-square tables from White's side, rank 8 first (the classic "simplified evaluation" values).
const PST: number[][] = [
  [],
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
];
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

const edge = (sq: number) => Math.max(3 - fileOf(sq), fileOf(sq) - 4) + Math.max(3 - rankOf(sq), rankOf(sq) - 4);

export function evaluate(p: Pos): number {
  const b = p.board;
  let s = 0, pieces = 0, wk = 0, bk = 0;
  for (let sq = 0; sq < 64; sq++) {
    const v = b[sq];
    if (!v) continue;
    const t = Math.abs(v);
    if (t === K) {
      if (v > 0) wk = sq;
      else bk = sq;
      continue;
    }
    if (t !== P) pieces += VALUE[t];
    const x = VALUE[t] + PST[t][v > 0 ? sq : sq ^ 56];
    s += v > 0 ? x : -x;
  }
  const endgame = pieces <= 2600;
  const kt = endgame ? KING_END : PST[K];
  s += kt[wk] - kt[bk ^ 56];
  // Mop-up: in a won ending, herd the lone king to the edge and walk ours over, so the engine actually mates.
  if (endgame && Math.abs(s) > 400) {
    const [win, lose] = s > 0 ? [wk, bk] : [bk, wk];
    const dist = Math.abs(fileOf(win) - fileOf(lose)) + Math.abs(rankOf(win) - rankOf(lose));
    s += Math.sign(s) * (10 * edge(lose) + 4 * (14 - dist));
  }
  return s * p.turn;
}

/** Legal moves, likely-best first: promotions, then captures by most valuable victim / least valuable attacker. */
function ordered(p: Pos, caps: boolean): number[] {
  const b = p.board;
  return legalMoves(p, caps)
    .map((m) => {
      const victim = capturedBy(p, m);
      const s = (victim ? 10_000 + 10 * VALUE[victim] - VALUE[Math.abs(b[fromOf(m)])] : 0) + (promoOf(m) ? 9_000 + VALUE[promoOf(m)] : 0);
      return [s, m];
    })
    .sort((x, y) => y[0] - x[0])
    .map((x) => x[1]);
}

function positionOf(p: Pos): Position {
  const stack: [number, Undo][] = [];
  let cache: number[] | null = null;
  return {
    moves: () => (cache ??= ordered(p, false)),
    noisy: () => ordered(p, true),
    make(m) {
      stack.push([m, make(p, m)]);
      cache = null;
    },
    undo() {
      const [m, u] = stack.pop()!;
      unmake(p, m, u);
      cache = null;
    },
    evaluate: () => evaluate(p),
    over() {
      if (!anyLegal(p)) return inCheck(p) ? -WIN : 0;
      return p.half >= 100 || insufficient(p.board) ? 0 : null;
    },
  };
}

export const LEVELS = [
  { name: "Novice", depth: 1, quiesce: false, noise: 150 },
  { name: "Club", depth: 2, quiesce: true, noise: 50 },
  { name: "Expert", depth: 3, quiesce: true, noise: 15 },
  { name: "Master", depth: 8, quiesce: true, noise: 8 },
];
export const tier = (level: number) => LEVELS[Math.min(level, LEVELS.length) - 1];
export const THINK_MS = 1500; // time budget per engine move; iterative deepening keeps the deepest finished pass

/** The engine's move. `now` (ms) enables the time budget; without it the search is depth-limited and exact. */
export function think(pos: Pos, level: number, rng: Rng, now?: () => number) {
  const L = tier(level);
  const p: Pos = { ...pos, board: pos.board.slice() };
  const end = now ? now() + THINK_MS : 0;
  return search(positionOf(p), {
    depth: L.depth,
    quiesce: L.quiesce,
    noise: L.noise,
    random: () => rng.next(),
    stop: now && (() => now() > end),
  });
}

// ---------- The game (one ladder run) ----------

function startGame(s: Pick<GambitState, "games">) {
  const pos = fromFen(START);
  return { pos, keys: [keyOf(pos)], you: (s.games % 2 === 0 ? 1 : -1) as Color, last: -1, ply: 0, result: null };
}

export function newGame(): GambitState {
  return { level: 1, games: 0, score: 0, ...startGame({ games: 0 }) };
}

export interface Played {
  captured: number; // piece type taken, or 0
  check: boolean;
  end: End | null;
}

/** Play a legal move for whoever is to move; scores captures (yours) and settles the game if it ends. */
export function play(s: GambitState, m: number): Played {
  const mover = s.pos.turn;
  const captured = capturedBy(s.pos, m);
  make(s.pos, m);
  s.last = m;
  s.ply++;
  if (s.pos.half === 0) s.keys = [];
  s.keys.push(keyOf(s.pos));
  if (mover === s.you && captured) s.score += CAPTURE_PTS[captured] * s.level;
  const end = ending(s.pos, s.keys);
  if (end) {
    const kind = end !== "mate" ? "draw" : mover === s.you ? "win" : "loss";
    const points = kind === "win" ? WIN_PTS * s.level : kind === "draw" ? DRAW_PTS * s.level : 0;
    s.score += points;
    s.result = { kind, why: end, points };
  }
  return { captured, check: inCheck(s.pos), end };
}

export function resign(s: GambitState) {
  if (!s.result) s.result = { kind: "loss", why: "resign", points: 0 };
}

/** After a win or draw: the next game of the ladder, colours swapped. */
export function nextGame(s: GambitState) {
  if (!s.result || s.result.kind === "loss") return;
  if (s.result.kind === "win") s.level++;
  s.games++;
  Object.assign(s, startGame(s));
}
