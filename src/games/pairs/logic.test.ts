import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { flip, newGame, nextBoard, sizeFor, tick, type PairsState } from "./logic";

const partner = (s: PairsState, i: number) => s.cards.findIndex((c, j) => j !== i && c === s.cards[i]);

describe("pairs", () => {
  it("deals each symbol exactly twice, shuffled by the seed", () => {
    const a = newGame(createRng(1)), b = newGame(createRng(1)), c = newGame(createRng(2));
    expect(a.cards).toEqual(b.cards);
    expect(a.cards).not.toEqual(c.cards);
    const counts = new Map<number, number>();
    a.cards.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(a.cards).toHaveLength(12);
  });

  it("a match stays up and builds a streak; a miss turns back on the next flip", () => {
    const s = newGame(createRng(3));
    const other = s.cards.findIndex((c) => c !== s.cards[0]);
    expect(flip(s, 0)).toBe("open");
    expect(flip(s, other)).toBe("miss");
    expect(s.open).toEqual([0, other]);
    expect(flip(s, partner(s, 0))).toBe("open"); // the miss closed first
    expect(s.open).toEqual([partner(s, 0)]);
    expect(flip(s, 0)).toBe("match");
    expect(s.score).toBe(10);
    const i = s.matched.findIndex((m) => !m);
    flip(s, i);
    flip(s, partner(s, i));
    expect(s.score).toBe(10 + 20); // streak of two
    expect(flip(s, 0)).toBeNull(); // matched cards are done
  });

  it("clearing banks the time left and deals a bigger board", () => {
    const rng = createRng(4);
    const s = newGame(rng);
    let r = null;
    for (let i = 0; i < s.cards.length; i++) if (!s.matched[i]) { flip(s, i); r = flip(s, partner(s, i)); }
    expect(r).toBe("cleared");
    nextBoard(s, rng);
    expect(s.cards.length).toBe(sizeFor(2).cols * sizeFor(2).rows);
    expect(s.cleared).toBe(false);
  });

  it("running out of time ends the run", () => {
    const s = newGame(createRng(5));
    tick(s, s.time + 1);
    expect(s.alive).toBe(false);
    expect(flip(s, 0)).toBeNull();
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame(createRng(6));
    flip(s, 0);
    const copy = JSON.parse(JSON.stringify(s)) as PairsState;
    expect(flip(copy, 1)).toEqual(flip(s, 1));
    expect(copy).toEqual(s);
  });
});
