/**
 * Crates rules. Pure: no DOM, no clock. Push every crate onto a mark; you can push one crate, never pull.
 * Levels are original, written as text (# wall, . mark, $ crate, * crate on mark, @ you, + you on a mark).
 * Every level is proven solvable by a breadth-first solver in the tests, which also checks its `best` move count.
 * Each level has a step budget (every step counts, even ones you undo); running out ends the run. Undo and
 * restart are free but give no steps back. Finishing the last level ends the run with a bonus.
 */
export type Dir = "up" | "down" | "left" | "right";
export interface Level {
  map: string[];
  best: number; // fewest moves, proven by the solver in the tests
}

export const LEVELS: Level[] = [
  { best: 5, map: ["#####", "#@  #", "# $ #", "#  .#", "#####"] },
  { best: 10, map: ["######", "#@   #", "# $$ #", "#  ..#", "######"] },
  { best: 11, map: ["#######", "#.  # #", "# $   #", "#  @$ #", "##   .#", " ######"] },
  { best: 14, map: ["######", "#    #", "# $$ #", "##.  #", " #.#@#", " #   #", " #####"] },
  { best: 15, map: ["#######", "#.    #", "#.$$  #", "## #@ #", " #    #", " ######"] },
  { best: 19, map: ["#######", "#..   #", "# ##$ #", "#  $  #", "# @#  #", "#     #", "#######"] },
  { best: 24, map: ["#########", "#   #   #", "# $   $ #", "#  ###  #", "#.  @  .#", "#########"] },
  { best: 27, map: ["  #####", "  #   #", "### # #", "#  $  #", "# #.#$##", "# . @ .#", "##$#   #", " #     #", " #######"] },
  { best: 39, map: ["########", "#@     #", "# $ $  #", "## ## ##", "#  ..  #", "#      #", "########"] },
  { best: 41, map: ["#######", "#  .  #", "# $#$ #", "#. @ .#", "# $#$ #", "#  .  #", "#######"] },
];

export interface CratesState {
  w: number;
  h: number;
  walls: number[]; // 1 = wall
  marks: number[]; // 1 = mark
  crates: number[]; // cell indices
  me: number;
  start: { crates: number[]; me: number };
  history: { me: number; crates: number[] }[]; // for undo
  level: number; // 1-based index into LEVELS
  budget: number; // steps left on this level
  moves: number; // steps taken on this level (undo doesn't take them back)
  score: number;
  alive: boolean;
  solved: boolean;
  finished: boolean; // solved the last level
}

export function parse(map: string[]) {
  const h = map.length, w = Math.max(...map.map((r) => r.length));
  const walls = Array(w * h).fill(0), marks = Array(w * h).fill(0), crates: number[] = [];
  let me = 0;
  map.forEach((row, r) => {
    for (let c = 0; c < w; c++) {
      const ch = row[c] ?? " ", i = r * w + c;
      if (ch === "#") walls[i] = 1;
      if (ch === "." || ch === "*" || ch === "+") marks[i] = 1;
      if (ch === "$" || ch === "*") crates.push(i);
      if (ch === "@" || ch === "+") me = i;
    }
  });
  return { w, h, walls, marks, crates, me };
}

export const budgetFor = (best: number) => Math.round(best * 2) + 15;

function load(levelNo: number, score: number): CratesState {
  const lv = LEVELS[levelNo - 1];
  const p = parse(lv.map);
  return { ...p, start: { crates: p.crates.slice(), me: p.me }, history: [], level: levelNo, budget: budgetFor(lv.best), moves: 0, score, alive: true, solved: false, finished: false };
}
export const newGame = () => load(1, 0);
export const nextLevel = (s: CratesState) => Object.assign(s, load(s.level + 1, s.score));

const DELTA = (w: number): Record<Dir, number> => ({ up: -w, down: w, left: -1, right: 1 });

export interface Stepped {
  pushed: number; // crate index that moved, or -1
  solved: boolean;
}

/** One step. Walks, or pushes a crate if the cell behind it is free. Returns null if blocked. */
export function step(s: CratesState, dir: Dir): Stepped | null {
  if (!s.alive || s.solved) return null;
  const d = DELTA(s.w)[dir];
  // Don't wrap around the sides of the map.
  const col = s.me % s.w;
  if ((dir === "left" && col === 0) || (dir === "right" && col === s.w - 1)) return null;
  const to = s.me + d;
  if (s.walls[to]) return null;
  const k = s.crates.indexOf(to);
  if (k >= 0) {
    const beyond = to + d;
    if (s.walls[beyond] || s.crates.includes(beyond)) return null;
  }
  s.history.push({ me: s.me, crates: s.crates.slice() });
  if (k >= 0) s.crates[k] = to + d;
  s.me = to;
  s.moves++;
  s.budget--;
  const solved = s.crates.every((c) => s.marks[c]);
  if (solved) {
    s.solved = true;
    s.score += 100 * s.level + 10 * s.budget;
    if (s.level === LEVELS.length) {
      s.finished = true;
      s.score += 500;
    }
  } else if (s.budget <= 0) s.alive = false;
  return { pushed: k, solved };
}

export function undo(s: CratesState): boolean {
  const last = s.history.pop();
  if (!last || !s.alive || s.solved) return false;
  s.me = last.me;
  s.crates = last.crates;
  return true;
}

export function restart(s: CratesState): boolean {
  if (!s.alive || s.solved || !s.history.length) return false;
  s.me = s.start.me;
  s.crates = s.start.crates.slice();
  s.history = [];
  return true;
}

/** Fewest moves to solve a map (breadth-first over you + crates), or -1. For proving levels in tests. */
export function solveMoves(map: string[], limit = 2_000_000): number {
  const p = parse(map);
  const dirs = [-p.w, p.w, -1, 1];
  const key = (me: number, crates: number[]) => me + ":" + crates.slice().sort((a, b) => a - b).join(",");
  // Dead squares: a crate in a non-mark corner can never move out.
  const dead = p.walls.map((wall, i) => {
    if (wall || p.marks[i]) return false;
    const up = p.walls[i - p.w], down = p.walls[i + p.w], left = p.walls[i - 1], right = p.walls[i + 1];
    return Boolean((up || down) && (left || right));
  });
  let frontier: [number, number[]][] = [[p.me, p.crates]];
  const seen = new Set([key(p.me, p.crates)]);
  for (let depth = 0; frontier.length && seen.size < limit; depth++) {
    const next: [number, number[]][] = [];
    for (const [me, crates] of frontier) {
      if (crates.every((c) => p.marks[c])) return depth;
      for (const d of dirs) {
        const to = me + d;
        if (p.walls[to]) continue;
        let cs = crates;
        const k = crates.indexOf(to);
        if (k >= 0) {
          const beyond = to + d;
          if (p.walls[beyond] || crates.includes(beyond) || dead[beyond]) continue;
          cs = crates.slice();
          cs[k] = beyond;
        }
        const id = key(to, cs);
        if (seen.has(id)) continue;
        seen.add(id);
        next.push([to, cs]);
      }
    }
    frontier = next;
  }
  return -1;
}
