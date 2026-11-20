/**
 * Solitaire (Klondike, draw one) rules and a deal checker. Pure: no DOM, no clock.
 * Card c: suit = c / 13 (0 spades, 1 hearts, 2 diamonds, 3 clubs), rank = c % 13 + 1. Hearts and diamonds are red.
 * Every deal is proven winnable before you see it: a depth-first solver (with the same three-pass stock rule)
 * must win it within a node budget, or the deal is thrown away.
 * A run is a series of deals: win one to get the next; get stuck (no move, no draw) and the run ends.
 */
import type { Rng } from "@/engine/rng";

export const MAX_PASSES = 3; // times through the stock
export const suitOf = (c: number) => Math.floor(c / 13);
export const rankOf = (c: number) => (c % 13) + 1;
export const isRed = (c: number) => suitOf(c) === 1 || suitOf(c) === 2;

export interface SolState {
  tab: number[][]; // 7 columns, bottom card first
  down: number[]; // face-down cards at the bottom of each column
  stock: number[]; // top = last
  waste: number[]; // top = last
  found: number[][]; // by suit
  passes: number; // passes through the stock started (1 at the deal)
  level: number;
  score: number;
  alive: boolean;
  won: boolean;
}

export type From = { kind: "waste" } | { kind: "tab"; col: number; idx: number } | { kind: "found"; suit: number };
export type To = { kind: "tab"; col: number } | { kind: "found" };

const fits = (card: number, onto: number | undefined) =>
  onto === undefined ? rankOf(card) === 13 : isRed(card) !== isRed(onto) && rankOf(card) === rankOf(onto) - 1;
const fitsFound = (s: SolState, card: number) => rankOf(card) === s.found[suitOf(card)].length + 1;

/** The cards a move would carry (one, or a face-up run from the tableau). */
export function carried(s: SolState, f: From): number[] {
  if (f.kind === "waste") return s.waste.length ? [s.waste[s.waste.length - 1]] : [];
  if (f.kind === "found") return s.found[f.suit].length ? [s.found[f.suit][s.found[f.suit].length - 1]] : [];
  const col = s.tab[f.col];
  return f.idx >= s.down[f.col] && f.idx < col.length ? col.slice(f.idx) : [];
}

export function legal(s: SolState, f: From, t: To): boolean {
  const cards = carried(s, f);
  if (!cards.length) return false;
  if (t.kind === "found") return cards.length === 1 && f.kind !== "found" && fitsFound(s, cards[0]);
  if (f.kind === "tab" && f.col === t.col) return false;
  const col = s.tab[t.col];
  return fits(cards[0], col[col.length - 1]);
}

export interface Moved {
  flipped: boolean; // a face-down card turned over
  won: boolean;
}

export function move(s: SolState, f: From, t: To): Moved | null {
  if (!s.alive || s.won || !legal(s, f, t)) return null;
  const cards = carried(s, f);
  if (f.kind === "waste") s.waste.pop();
  else if (f.kind === "found") s.found[f.suit].pop();
  else s.tab[f.col].splice(f.idx);
  if (t.kind === "found") {
    s.found[suitOf(cards[0])].push(cards[0]);
    if (f.kind !== "found") s.score += 10;
  } else {
    s.tab[t.col].push(...cards);
    if (f.kind === "waste") s.score += 5;
    if (f.kind === "found") s.score = Math.max(0, s.score - 15);
  }
  let flipped = false;
  if (f.kind === "tab" && s.down[f.col] > 0 && s.down[f.col] >= s.tab[f.col].length) {
    s.down[f.col] = s.tab[f.col].length - 1; // turn the new top card over
    s.score += 5;
    flipped = true;
  }
  const won = s.found.every((p) => p.length === 13);
  if (won) {
    s.won = true;
    s.score += 300 * s.level;
  }
  return { flipped, won };
}

/** Turn a card from the stock, or turn the waste back over (while passes remain). */
export function draw(s: SolState): boolean {
  if (!s.alive || s.won) return false;
  if (s.stock.length) {
    s.waste.push(s.stock.pop()!);
    return true;
  }
  if (!s.waste.length || s.passes >= MAX_PASSES) return false;
  s.stock = s.waste.reverse();
  s.waste = [];
  s.passes++;
  return true;
}

export const canDraw = (s: SolState) => s.stock.length > 0 || (s.waste.length > 0 && s.passes < MAX_PASSES);

/** Where a tapped card should go: a foundation if it can, else the first tableau column that takes it. */
export function autoTarget(s: SolState, f: From): To | null {
  if (legal(s, f, { kind: "found" })) return { kind: "found" };
  const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => Number(s.tab[a].length === 0) - Number(s.tab[b].length === 0)); // non-empty first
  for (const col of order) if (legal(s, f, { kind: "tab", col })) return { kind: "tab", col };
  return null;
}

/** Every move worth making (no pointless shuffles). */
export function moves(s: SolState): [From, To][] {
  const out: [From, To][] = [];
  const froms: From[] = [{ kind: "waste" }];
  s.tab.forEach((col, c) => {
    for (let i = s.down[c]; i < col.length; i++) froms.push({ kind: "tab", col: c, idx: i });
  });
  for (const f of froms) {
    if (legal(s, f, { kind: "found" })) out.push([f, { kind: "found" }]);
    for (let col = 0; col < 7; col++) {
      if (!legal(s, f, { kind: "tab", col })) continue;
      // Moving a king from the bottom of a column to an empty one changes nothing.
      if (f.kind === "tab" && f.idx === 0 && s.tab[col].length === 0) continue;
      out.push([f, { kind: "tab", col }]);
    }
  }
  return out;
}

export const stuck = (s: SolState) => !s.won && !canDraw(s) && moves(s).length === 0;

function dealCards(rng: Rng): Omit<SolState, "level" | "score" | "alive" | "won"> {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = rng.int(0, i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tab: number[][] = [];
  for (let c = 0; c < 7; c++) tab.push(deck.splice(0, c + 1));
  return { tab, down: tab.map((col) => col.length - 1), stock: deck, waste: [], found: [[], [], [], []], passes: 1 };
}

const clone = (s: SolState): SolState => ({ ...s, tab: s.tab.map((c) => c.slice()), down: s.down.slice(), stock: s.stock.slice(), waste: s.waste.slice(), found: s.found.map((f) => f.slice()) });

/** Can this position be won? Depth-first with foundation moves first; gives up (false) past the node budget. */
export function winnable(start: SolState, budget = 3000): boolean { // small budget: quick to give up on hard deals (worst ~170 ms on a laptop)
  const seen = new Set<string>();
  let nodes = 0;
  const go = (s: SolState): boolean => {
    if (s.found.every((p) => p.length === 13)) return true;
    if (++nodes > budget) return false;
    const key = s.tab.map((c, i) => s.down[i] + ":" + c.join(",")).join("|") + "/" + s.stock.length + "/" + s.waste.join(",") + "/" + s.passes;
    if (seen.has(key)) return false;
    seen.add(key);
    // Best first: to the foundation, then moves that turn a card over, then the rest, then drawing.
    const ms = moves(s).sort(([fa, ta], [fb, tb]) => score(s, fb, tb) - score(s, fa, ta));
    for (const [f, t] of ms) {
      const n = clone(s);
      n.alive = true;
      n.won = false;
      move(n, f, t);
      if (go(n)) return true;
    }
    if (canDraw(s)) {
      const n = clone(s);
      draw(n);
      if (go(n)) return true;
    }
    return false;
  };
  return go(clone(start));
}
const score = (s: SolState, f: From, t: To) =>
  (t.kind === "found" ? 100 : 0) + (f.kind === "tab" && f.idx === s.down[f.col] && s.down[f.col] > 0 ? 50 : 0) + (f.kind === "waste" ? 10 : 0);

export function newDeal(level: number, score: number, rng: Rng): SolState {
  for (;;) {
    const s: SolState = { ...dealCards(rng), level, score, alive: true, won: false };
    if (winnable(s)) return s;
  }
}
export const newGame = (rng: Rng) => newDeal(1, 0, rng);
export const nextDeal = (s: SolState, rng: Rng) => Object.assign(s, newDeal(s.level + 1, s.score, rng));

/** When every card is face up and the stock is spent, the next card that can go to a foundation. */
export function autoFinishStep(s: SolState): [From, To] | null {
  if (s.down.some((d) => d > 0) || s.stock.length) return null;
  const froms: From[] = [{ kind: "waste" }, ...s.tab.map((col, c) => ({ kind: "tab" as const, col: c, idx: col.length - 1 }))];
  for (const f of froms) if (legal(s, f, { kind: "found" })) return [f, { kind: "found" }];
  return null;
}
