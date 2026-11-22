/**
 * Word Hunt rules. Pure: no DOM, no clock (time arrives through tick()); the dictionary is passed in.
 * A 4 × 4 grid of letters. Trace a word through neighbouring cells (diagonals count, no cell twice).
 * Words need 3+ letters and must be in the dictionary; a plain plural of a listed word (+s / +es) counts too,
 * because the bundled list (Webster's 2nd, public domain) only has base forms.
 * Each round lasts 150 / 120 / 90 s (Easy / Medium / Hard) and has a target; reach it to play the next round, miss it and the run ends.
 */
import type { Rng } from "@/engine/rng";

export const N = 4;
export const ROUND_TIME = 120;
/** Seconds per round: 150 / 120 / 90. */
export const roundTime = (d = 1) => [150, ROUND_TIME, 90][d];
export interface Dict {
  words: string[]; // sorted
  set: Set<string>;
}
export interface HuntState {
  grid: string[];
  found: string[];
  points: number; // this round
  target: number;
  possible: number; // words the grid holds (for the end-of-round tally)
  time: number;
  level: number;
  d?: number; // difficulty 0 Easy, 1 Medium, 2 Hard (missing = Medium)
  score: number;
  alive: boolean;
  roundOver: boolean;
}

export function makeDict(text: string): Dict {
  const words = text.split("\n").map((w) => w.trim()).filter((w) => w.length >= 3).sort();
  return { words, set: new Set(words) };
}

export function isWord(d: Dict, w: string): boolean {
  if (w.length < 3) return false;
  if (d.set.has(w)) return true;
  if (w.endsWith("es") && d.set.has(w.slice(0, -2))) return true;
  return w.endsWith("s") && w.length > 3 && d.set.has(w.slice(0, -1));
}

/** Could some word (or its plural) start with p? Binary search on the sorted list. */
export function hasPrefix(d: Dict, p: string): boolean {
  let lo = 0, hi = d.words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d.words[mid] < p) lo = mid + 1;
    else hi = mid;
  }
  if (lo < d.words.length && d.words[lo].startsWith(p)) return true;
  // "...s" / "...es" endings of a full word are prefixes of its plural.
  return isWord(d, p.replace(/e?s$/, "")) || d.set.has(p.slice(0, -1)) || d.set.has(p.slice(0, -2));
}

export const pointsFor = (w: string) => (w.length <= 4 ? 1 : w.length === 5 ? 2 : w.length === 6 ? 3 : w.length === 7 ? 5 : 11);

export const neighbours = (i: number) => {
  const r = Math.floor(i / N), c = i % N, out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
    }
  return out;
};

/** Every word in the grid (depth-first, pruned by prefix). */
export function solve(grid: string[], d: Dict): Set<string> {
  const out = new Set<string>();
  const used = Array(N * N).fill(false);
  const go = (i: number, w: string) => {
    if (w.length > 8 || !hasPrefix(d, w)) return;
    if (isWord(d, w)) out.add(w);
    used[i] = true;
    for (const j of neighbours(i)) if (!used[j]) go(j, w + grid[j]);
    used[i] = false;
  };
  for (let i = 0; i < N * N; i++) go(i, grid[i]);
  return out;
}

/** A path of cells spelling `word`, or null. */
export function pathFor(grid: string[], word: string): number[] | null {
  const path: number[] = [];
  const go = (i: number, k: number): boolean => {
    if (grid[i] !== word[k] || path.includes(i)) return false;
    path.push(i);
    if (k === word.length - 1) return true;
    for (const j of neighbours(i)) if (go(j, k + 1)) return true;
    path.pop();
    return false;
  };
  for (let i = 0; i < N * N; i++) if (go(i, 0)) return path;
  return null;
}

// English-ish letter weights (no q: it needs a u to be useful).
const LETTERS = "eeeeeeeeeeeeaaaaaaaaarrrrrriiiiiiiiooooooootttttttnnnnnnnsssssslllllcccuuuudddpppmmmhhhgggbbfffyyywwkvxzj";

export const targetFor = (level: number) => 8 + level * 4;

export function newRound(level: number, score: number, rng: Rng, d: Dict, lv = 1): HuntState {
  const target = targetFor(level);
  for (;;) {
    const grid = Array.from({ length: N * N }, () => rng.pick([...LETTERS]));
    const vowels = grid.filter((ch) => "aeiou".includes(ch)).length;
    if (vowels < 4 || vowels > 8) continue;
    const all = [...solve(grid, d)];
    const possible = all.reduce((n, w) => n + pointsFor(w), 0);
    if (all.length >= 25 && possible >= target * 4)
      return { grid, found: [], points: 0, target, possible: all.length, time: roundTime(lv), level, score, alive: true, roundOver: false, d: lv };
  }
}
export const newGame = (rng: Rng, d: Dict, lv = 1) => newRound(1, 0, rng, d, lv);
export const nextRound = (s: HuntState, rng: Rng, d: Dict) => Object.assign(s, newRound(s.level + 1, s.score, rng, d, s.d ?? 1));

export type Tried = "word" | "dup" | "short" | "nope";

/** Check a traced path (cell indices). */
export function trace(s: HuntState, path: number[], d: Dict): Tried | null {
  if (!s.alive || s.roundOver) return null;
  const valid = path.every((c, k) => c >= 0 && c < N * N && path.indexOf(c) === k && (k === 0 || neighbours(path[k - 1]).includes(c)));
  if (!valid) return null;
  const w = path.map((c) => s.grid[c]).join("");
  if (w.length < 3) return "short";
  if (s.found.includes(w)) return "dup";
  if (!isWord(d, w)) return "nope";
  s.found.push(w);
  s.points += pointsFor(w);
  s.score += pointsFor(w) * 10;
  return "word";
}

/** The clock. When it runs out, the round ends: reach the target to go on, else the run ends. */
export function tick(s: HuntState, dt: number) {
  if (!s.alive || s.roundOver) return;
  s.time = Math.max(0, s.time - dt);
  if (s.time > 0) return;
  s.roundOver = true;
  if (s.points < s.target) s.alive = false;
  else s.score += 50 * s.level;
}
