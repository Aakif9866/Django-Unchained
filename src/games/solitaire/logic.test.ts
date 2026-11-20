import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { MAX_PASSES, autoFinishStep, autoTarget, draw, legal, move, moves, newGame, nextDeal, stuck, winnable, type SolState } from "./logic";

const empty = (): SolState => ({
  tab: [[], [], [], [], [], [], []], down: [0, 0, 0, 0, 0, 0, 0], stock: [], waste: [], found: [[], [], [], []], passes: 1,
  level: 1, score: 0, alive: true, won: false,
});
const card = (rank: number, suit: number) => suit * 13 + rank - 1; // suit 0 ♠ 1 ♥ 2 ♦ 3 ♣

describe("solitaire", () => {
  it("deals 7 columns, 24 in the stock, every card once", () => {
    const s = newGame(createRng(1));
    expect(s.tab.map((c) => c.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.down).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(s.stock).toHaveLength(24);
    expect(new Set([...s.tab.flat(), ...s.stock]).size).toBe(52);
  });

  it("every deal is one the solver can win", () => {
    for (let seed = 1; seed <= 4; seed++) expect(winnable(newGame(createRng(seed)))).toBe(true);
  });

  it("builds down in alternating colours; only kings take an empty column", () => {
    const s = empty();
    s.tab[0] = [card(9, 0)]; // 9♠
    s.waste = [card(8, 1)]; // 8♥ fits
    expect(legal(s, { kind: "waste" }, { kind: "tab", col: 0 })).toBe(true);
    s.waste = [card(8, 3)]; // 8♣: same colour
    expect(legal(s, { kind: "waste" }, { kind: "tab", col: 0 })).toBe(false);
    expect(legal(s, { kind: "waste" }, { kind: "tab", col: 1 })).toBe(false);
    s.waste = [card(13, 3)];
    expect(legal(s, { kind: "waste" }, { kind: "tab", col: 1 })).toBe(true);
  });

  it("foundations go up by suit from the ace; moving a run turns the card beneath", () => {
    const s = empty();
    s.tab[0] = [card(5, 2), card(1, 0)];
    s.down[0] = 1;
    expect(autoTarget(s, { kind: "tab", col: 0, idx: 1 })).toEqual({ kind: "found" });
    const r = move(s, { kind: "tab", col: 0, idx: 1 }, { kind: "found" })!;
    expect(r.flipped).toBe(true);
    expect(s.down[0]).toBe(0);
    expect(s.score).toBe(15);
    expect(legal(s, { kind: "tab", col: 0, idx: 0 }, { kind: "found" })).toBe(false); // 5♦ needs A–4♦ first
  });

  it("the stock turns over until its passes run out, then you can be stuck", () => {
    const s = empty();
    s.stock = [card(2, 0), card(2, 1)];
    s.found = [[card(1, 0)], [], [], []]; // something on the board, nothing else
    expect(draw(s)).toBe(true);
    expect(draw(s)).toBe(true);
    for (let p = 1; p < MAX_PASSES; p++) {
      expect(draw(s)).toBe(true); // recycle
      draw(s);
      draw(s);
    }
    s.waste = s.waste.filter((c) => c !== card(2, 0)); // the 2♠ would fit; take it away to be truly stuck
    expect(draw(s)).toBe(false);
    expect(moves(s).length).toBe(0);
    expect(stuck(s)).toBe(true);
  });

  it("finishes itself once everything is face up, and a win scores and deals again", () => {
    const rng = createRng(2);
    const s = empty();
    for (let suit = 0; suit < 4; suit++) s.found[suit] = Array.from({ length: 12 }, (_, r) => card(r + 1, suit));
    s.tab[0] = [card(13, 0)]; // the four kings left: three on the table, one on the waste
    s.tab[1] = [card(13, 2)];
    s.tab[2] = [card(13, 1)];
    s.waste = [card(13, 3)];
    let step;
    while ((step = autoFinishStep(s))) move(s, ...step);
    expect(s.won).toBe(true);
    expect(s.score).toBe(40 + 300);
    nextDeal(s, rng);
    expect(s).toMatchObject({ level: 2, won: false, passes: 1 });
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame(createRng(3));
    draw(s);
    const copy = JSON.parse(JSON.stringify(s)) as SolState;
    const m = moves(s)[0];
    if (m) expect(move(copy, ...m)).toEqual(move(s, ...m));
    expect(draw(copy)).toBe(draw(s));
    expect(copy).toEqual(s);
  });
});
