/**
 * Game-tree search shared by the board games (Gambit, Reversi, Four Up): negamax with alpha-beta pruning,
 * iterative deepening, an optional quiescence pass, and root "noise" so the lower levels play like people.
 * Pure: moves are numbers, and the clock and randomness are injected, so tests are deterministic.
 */
export const WIN = 1_000_000;

export interface Position {
  /** Legal moves for the side to move, most promising first. Only called when over() is null. */
  moves(): number[];
  /** Captures to keep resolving past the horizon (quiescence). Chess only. */
  noisy?(): number[];
  make(m: number): void;
  undo(): void;
  /** Static score for the side to move. */
  evaluate(): number;
  /** Game over here? The final score for the side to move (about ±WIN, or 0 for a draw). Otherwise null. */
  over(): number | null;
}

export interface Limits {
  depth: number;
  /** Search captures past the horizon (default: when the position has noisy()). */
  quiesce?: boolean;
  /** True once time is up. Polled every 1024 nodes after depth 1; the deepest finished pass is used. */
  stop?: () => boolean;
  /** Pick at random among root moves scoring within this much of the best. */
  noise?: number;
  random?: () => number;
}

export interface Result {
  move: number;
  score: number;
  depth: number;
}

const TIMEOUT = Symbol("timeout");

export function search(pos: Position, lim: Limits): Result {
  const q = lim.quiesce ?? Boolean(pos.noisy);
  const noise = lim.noise ?? 0;
  let nodes = 0;
  let made = 0;
  let canStop = false;
  const make = (m: number) => {
    pos.make(m);
    made++;
  };
  const undo = () => {
    pos.undo();
    made--;
  };
  const tick = () => {
    if (canStop && (++nodes & 1023) === 0 && lim.stop?.()) throw TIMEOUT;
  };

  const quiesce = (alpha: number, beta: number): number => {
    tick();
    const stand = pos.evaluate();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    for (const m of pos.noisy!()) {
      make(m);
      const v = -quiesce(-beta, -alpha);
      undo();
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  };

  const negamax = (depth: number, alpha: number, beta: number, ply: number): number => {
    tick();
    const end = pos.over();
    if (end !== null) return end > 0 ? end - ply : end < 0 ? end + ply : 0; // prefer quick wins, slow losses
    if (depth <= 0) return q ? quiesce(alpha, beta) : pos.evaluate();
    let best = -Infinity;
    for (const m of pos.moves()) {
      make(m);
      const v = -negamax(depth - 1, -beta, -alpha, ply + 1);
      undo();
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  };

  const root = pos.moves().map((m) => ({ m, v: -Infinity }));
  if (!root.length) throw new Error("search: no legal moves");
  let done = root.map((r) => ({ ...r }));
  let depth = 0;
  for (let d = 1; d <= lim.depth; d++) {
    canStop = d > 1;
    try {
      let best = -Infinity;
      for (const r of root) {
        make(r.m);
        // Anything worse than best − noise can never be picked, so it's allowed to fail low.
        r.v = -negamax(d - 1, -Infinity, -(best - noise), 1);
        undo();
        if (r.v > best) best = r.v;
      }
    } catch (e) {
      if (e !== TIMEOUT) throw e;
      while (made > 0) undo();
      break;
    }
    root.sort((a, b) => b.v - a.v); // best first: the next, deeper pass prunes far more
    done = root.map((r) => ({ ...r }));
    depth = d;
    if (done[0].v > WIN / 2) break; // a forced win; going deeper only finds slower ones
  }
  const top = done[0].v;
  const pool = noise > 0 && lim.random ? done.filter((r) => r.v > top - noise) : [done[0]];
  const pick = pool[Math.floor((lim.random?.() ?? 0) * pool.length)] ?? done[0];
  return { move: pick.m, score: pick.v, depth };
}
