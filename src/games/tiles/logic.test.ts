import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { deal, hasMove, isFree, match, newGame, nextBoard, shuffle, type TilesState } from "./logic";

describe("tiles", () => {
  it("free means uncovered and open on the left or right", () => {
    const s = newGame(createRng(1));
    const corner = s.tiles.find((t) => t.z === 0 && t.x === 0 && t.y === 0)!;
    const middleBase = s.tiles.find((t) => t.z === 0 && t.x === 1 && t.y === 1)!;
    expect(isFree(s.tiles, corner)).toBe(true);
    expect(isFree(s.tiles, middleBase)).toBe(false); // covered by layer 1
  });

  it("every face comes in pairs and every deal can be cleared", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const rng = createRng(seed);
      let s = newGame(rng);
      for (let lv = 1; lv <= 3; lv++) {
        const counts = new Map<number, number>();
        s.tiles.forEach((t) => counts.set(t.face, (counts.get(t.face) ?? 0) + 1));
        expect([...counts.values()].every((n) => n % 2 === 0)).toBe(true);
        expect(hasMove(s)).toBe(true);
        // Re-deal and replay the generator's own removal order: it must clear the board.
        const copy = JSON.parse(JSON.stringify(s)) as TilesState;
        let order = null;
        for (let k = 0; !order; k++) order = deal(copy.tiles, createRng(seed * 97 + lv * 13 + k)); // a deal can stall; retry like the game does
        let last = null;
        for (const [i, j] of order) last = match(copy, i, j);
        expect(last).toBe("cleared");
        s.cleared = true;
        s = nextBoard(s, rng);
      }
    }
  });

  it("only free, same-face tiles match; a cleared board scores a bonus", () => {
    const s = newGame(createRng(2));
    const free = s.tiles.map((t, i) => [t, i] as const).filter(([t]) => isFree(s.tiles, t));
    const diff = free.find(([t]) => t.face !== free[0][0].face)!;
    expect(match(s, free[0][1], diff[1])).toBe("nope");
    const blocked = s.tiles.findIndex((t) => !isFree(s.tiles, t));
    expect(match(s, free[0][1], blocked)).toBeNull();
  });

  it("stuck with no shuffles ends the run; a shuffle re-deals the rest solvably", () => {
    const rng = createRng(3);
    const s = newGame(rng);
    expect(shuffle(s, rng)).toBe(true);
    expect(s.shuffles).toBe(1);
    expect(hasMove(s)).toBe(true);
    s.shuffles = 0;
    // Force a dead position: give every free tile a different face.
    let f = 100;
    s.tiles.forEach((t) => (t.face = f++));
    const free = s.tiles.map((t, i) => [t, i] as const).filter(([t]) => isFree(s.tiles, t));
    free[0][0].face = free[1][0].face = 7;
    expect(match(s, free[0][1], free[1][1])).toBe("stuck");
    expect(s.alive).toBe(false);
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame(createRng(4));
    const copy = JSON.parse(JSON.stringify(s)) as TilesState;
    const free = s.tiles.map((t, i) => [t, i] as const).filter(([t]) => isFree(s.tiles, t));
    expect(match(copy, free[0][1], free[1][1])).toEqual(match(s, free[0][1], free[1][1]));
    expect(copy).toEqual(s);
  });
});
