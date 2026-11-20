/**
 * Turnstile rules. Pure: no DOM, no clock. cell = row * w + col.
 * The board has plain floor and coloured turnstiles, each carrying a path piece (straight, corner or tee).
 * Tapping a turnstile turns every turnstile of its colour a quarter clockwise, together, like linked gears.
 * When a path joins the bot's pad to the goal, the bot walks home along the shortest route.
 * Levels are original and written as tokens: . void, # floor, S start, G goal, and turnstiles like aL1
 * (group a, corner piece, turned once). The tests prove every level solvable and check its par (fewest taps).
 * Each level allows par + slack taps; running out ends the run, and finishing the last level ends it with a bonus.
 */
export const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
const SHAPES: Record<string, number> = { I: UP | DOWN, L: UP | RIGHT, T: UP | RIGHT | DOWN };
export const turn = (m: number) => ((m << 1) | (m >> 3)) & 15;

export interface Level {
  map: string[];
  par: number;
}
// Each was drawn solved, then scrambled to its hardest start (the turn of each group that needs the most taps).
export const LEVELS: Level[] = [
  { par: 1, map: ["S # aI2 # G"] },
  { par: 2, map: ["S aI2 bI2 G"] },
  { par: 3, map: ["S aL3 .", ". aI1 .", ". aL1 G"] },
  { par: 4, map: ["S # aL3 .", ". . bI1 .", ". . aL1 G"] },
  { par: 4, map: ["S aT2 # .", ". bI1 . .", ". aL1 # G"] },
  { par: 6, map: ["S aI2 bL3 .", ". . bI1 .", ". . aL1 G"] },
  { par: 7, map: ["S aI2 bL3 .", ". . aI1 .", "G cI2 cL0 ."] },
  { par: 7, map: ["S aI2 aI2 bL3 .", ". . . cI1 .", "G cI2 bI2 aL0 ."] },
  { par: 7, map: ["S aT2 bI2 cL3 .", ". bI1 . aI1 .", ". aL1 cT3 bL1 G"] },
  { par: 8, map: ["S aI2 bL3 . .", ". . cI1 . .", ". . aL1 dI2 bL3", ". . . . cI1", ". . G dI2 aL0"] },
];

export interface TurnState {
  w: number;
  h: number;
  kinds: string[]; // "" void, "#" floor, "S", "G", or a group letter for a turnstile
  open: number[]; // current openings per cell
  start: number;
  goal: number;
  level: number;
  par: number;
  taps: number; // taps left on this level
  score: number;
  alive: boolean;
  solved: boolean;
  finished: boolean;
}

export function parse(map: string[]) {
  const rows = map.map((r) => r.trim().split(/\s+/));
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const kinds: string[] = Array(w * h).fill("");
  const open: number[] = Array(w * h).fill(0);
  let start = 0, goal = 0;
  rows.forEach((row, r) =>
    row.forEach((t, c) => {
      const i = r * w + c;
      if (t === ".") return;
      if (t === "#" || t === "S" || t === "G") {
        kinds[i] = t;
        open[i] = 15;
        if (t === "S") start = i;
        if (t === "G") goal = i;
        return;
      }
      kinds[i] = t[0];
      let m = SHAPES[t[1]];
      for (let k = Number(t[2] ?? 0); k > 0; k--) m = turn(m);
      open[i] = m;
    }),
  );
  return { w, h, kinds, open, start, goal };
}

const NB: [number, number, number, number][] = [
  [UP, -1, 0, DOWN],
  [RIGHT, 0, 1, LEFT],
  [DOWN, 1, 0, UP],
  [LEFT, 0, -1, RIGHT],
];

/** Shortest walk from start to goal through openings that meet (cells, start first), or null. */
export function route(s: Pick<TurnState, "w" | "h" | "open" | "start" | "goal">): number[] | null {
  const prev = new Map<number, number>([[s.start, -1]]);
  const todo = [s.start];
  while (todo.length) {
    const i = todo.shift()!;
    if (i === s.goal) {
      const path: number[] = [];
      for (let k = i; k !== -1; k = prev.get(k)!) path.unshift(k);
      return path;
    }
    const r = Math.floor(i / s.w), c = i % s.w;
    for (const [bit, dr, dc, back] of NB) {
      const rr = r + dr, cc = c + dc, j = rr * s.w + cc;
      if (!(s.open[i] & bit) || rr < 0 || rr >= s.h || cc < 0 || cc >= s.w || !(s.open[j] & back) || prev.has(j)) continue;
      prev.set(j, i);
      todo.push(j);
    }
  }
  return null;
}

export const groupsOf = (kinds: string[]) => [...new Set(kinds.filter((k) => k >= "a" && k <= "z"))].sort();

/** Turn every turnstile in a group a quarter clockwise. */
export function spin(open: number[], kinds: string[], group: string) {
  kinds.forEach((k, i) => {
    if (k === group) open[i] = turn(open[i]);
  });
}

/** Fewest taps to connect start and goal (breadth-first over group turns), or -1. For proving levels in tests. */
export function solveTaps(map: string[]): number {
  const p = parse(map);
  const groups = groupsOf(p.kinds);
  const seen = new Set<string>();
  let frontier = [p.open];
  for (let depth = 0; frontier.length; depth++) {
    const next: number[][] = [];
    for (const open of frontier) {
      if (route({ ...p, open })) return depth;
      for (const g of groups) {
        const o = open.slice();
        spin(o, p.kinds, g);
        const k = o.join();
        if (!seen.has(k)) {
          seen.add(k);
          next.push(o);
        }
      }
    }
    frontier = next;
  }
  return -1;
}

export const tapsFor = (par: number) => par + 4;

function load(levelNo: number, score: number): TurnState {
  const lv = LEVELS[levelNo - 1];
  return { ...parse(lv.map), level: levelNo, par: lv.par, taps: tapsFor(lv.par), score, alive: true, solved: false, finished: false };
}
export const newGame = () => load(1, 0);
export const nextLevel = (s: TurnState) => Object.assign(s, load(s.level + 1, s.score));

/** Tap a turnstile: its whole group turns. Returns the bot's route home if that opened one, else []. */
export function tap(s: TurnState, cell: number): number[] | null {
  const g = s.kinds[cell];
  if (!s.alive || s.solved || !(g >= "a" && g <= "z")) return null;
  spin(s.open, s.kinds, g);
  s.taps--;
  const path = route(s);
  if (path) {
    s.solved = true;
    s.score += 100 * s.level + 25 * s.taps;
    if (s.level === LEVELS.length) {
      s.finished = true;
      s.score += 500;
    }
    return path;
  }
  if (s.taps <= 0) s.alive = false;
  return [];
}
