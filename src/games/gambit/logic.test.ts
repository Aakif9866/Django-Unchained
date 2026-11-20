import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { WIN } from "../search";
import {
  K, N, P, Q, R, START, ending, evaluate, fromFen, fromOf, inCheck, keyOf, legalMoves, make, moveOf, nameOf, newGame,
  nextGame, perft, play, promoOf, resign, sqOf, think, toOf, unmake, type GambitState, type Pos,
} from "./logic";

const mv = (p: Pos, uci: string) => {
  const m = legalMoves(p).find((x) => nameOf(fromOf(x)) + nameOf(toOf(x)) + (promoOf(x) ? " pnbrqk"[promoOf(x)] : "") === uci);
  if (m === undefined) throw new Error(`illegal: ${uci}`);
  return m;
};
const playAll = (s: GambitState, ucis: string[]) => ucis.forEach((u) => play(s, mv(s.pos, u)));

describe("gambit: move generation (perft)", () => {
  // Standard reference counts (chessprogramming.org "Perft Results").
  const cases: [string, string, number[]][] = [
    ["start", START, [20, 400, 8902, 197281]],
    ["kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
    ["position 3", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
    ["position 4", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
    ["position 5", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]],
  ];
  for (const [name, fen, counts] of cases)
    it(`${name} matches to depth ${counts.length}`, () => {
      const p = fromFen(fen);
      const before = JSON.stringify(p);
      counts.forEach((n, i) => expect(perft(p, i + 1)).toBe(n));
      expect(JSON.stringify(p)).toBe(before); // make/unmake restores everything
    });
});

describe("gambit: rules", () => {
  it("castles both ways and drops the rights", () => {
    const p = fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const ks = mv(p, "e1g1");
    const u = make(p, ks);
    expect(p.board[sqOf("g1")]).toBe(K);
    expect(p.board[sqOf("f1")]).toBe(R);
    expect(p.board[sqOf("h1")]).toBe(0);
    expect(p.castle & 3).toBe(0);
    unmake(p, ks, u);
    make(p, mv(p, "e1c1"));
    expect(p.board[sqOf("d1")]).toBe(R);
    expect(p.board[sqOf("a1")]).toBe(0);
    make(p, mv(p, "a8a1")); // black rook takes the a1 corner (empty now), losing its own queen-side right
    expect(p.castle).toBe(4);
  });

  it("refuses to castle through check", () => {
    const p = fromFen("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1"); // f2 rook covers f1
    const ucis = legalMoves(p).map((m) => nameOf(fromOf(m)) + nameOf(toOf(m)));
    expect(ucis).not.toContain("e1g1");
    expect(ucis).toContain("e1c1"); // the queen side is clear and unattacked
  });

  it("captures en passant, removing the pawn behind", () => {
    const p = fromFen("rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
    const m = mv(p, "e5d6");
    make(p, m);
    expect(p.board[sqOf("d6")]).toBe(P);
    expect(p.board[sqOf("d5")]).toBe(0);
  });

  it("promotes to any of four pieces", () => {
    const p = fromFen("8/P7/8/8/8/8/8/k6K w - - 0 1");
    const promos = legalMoves(p).filter((m) => toOf(m) === sqOf("a8")).map(promoOf).sort();
    expect(promos).toEqual([N, 3, R, Q].sort());
  });

  it("detects checkmate, stalemate, the 50-move rule and bare kings", () => {
    const s = newGame();
    playAll(s, ["f2f3", "e7e5", "g2g4", "d8h4"]);
    expect(s.result).toMatchObject({ kind: "loss", why: "mate" });
    expect(ending(fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), [])).toBe("stalemate");
    expect(ending(fromFen("7k/8/8/8/8/8/R7/K7 w - - 100 80"), [])).toBe("fifty");
    expect(ending(fromFen("8/8/8/8/8/8/8/k5BK w - - 0 1"), [])).toBe("material");
    expect(ending(fromFen("8/8/8/3b4/8/8/8/k4B1K w - - 0 1"), [])).toBe("material"); // same-shade bishops
    expect(ending(fromFen("8/8/8/4b3/8/8/8/k4B1K w - - 0 1"), [])).toBeNull(); // opposite shades can still mate
  });

  it("calls threefold repetition", () => {
    const s = newGame();
    playAll(s, ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1"]);
    expect(s.result).toBeNull();
    playAll(s, ["f6g8"]);
    expect(s.result).toMatchObject({ kind: "draw", why: "repetition" });
  });

  it("only lets the side to move stay out of check", () => {
    const p = fromFen("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1");
    expect(inCheck(p)).toBe(true);
    for (const m of legalMoves(p)) {
      const u = make(p, m);
      expect(inCheck(p, 1)).toBe(false);
      unmake(p, m, u);
    }
  });
});

describe("gambit: engine", () => {
  const best = (fen: string, level: number) => think(fromFen(fen), level, createRng(7));

  it("finds mate in one at every level", () => {
    for (let level = 1; level <= 4; level++) {
      const r = best("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", level);
      expect(nameOf(fromOf(r.move)) + nameOf(toOf(r.move))).toBe("a1a8");
    }
  });

  it("finds a forced mate in two from level 3", () => {
    const r = best("7k/8/8/8/8/8/R7/1R4K1 w - - 0 1", 3);
    expect(r.score).toBeGreaterThan(WIN / 2);
  });

  it("takes a hanging queen and doesn't hang its own", () => {
    expect(nameOf(toOf(best("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1", 2).move))).toBe("d5");
    // Black queen attacked by a pawn: the engine (black) moves it rather than leaving it.
    const r = best("4k3/8/8/3q4/4P3/8/8/4K3 b - - 0 1", 2);
    expect(nameOf(fromOf(r.move))).toBe("d5");
  });

  it("scores material from the side to move", () => {
    const p = fromFen("4k3/8/8/8/8/8/8/3QK3 w - - 0 1");
    expect(evaluate(p)).toBeGreaterThan(800);
    p.turn = -1;
    expect(evaluate(p)).toBeLessThan(-800);
  });

  it("returns a move within the time budget", () => {
    let t = 0;
    const r = think(fromFen(START), 4, createRng(1), () => (t += 100)); // each poll costs 100 ms of fake time
    expect(legalMoves(fromFen(START))).toContain(r.move);
    expect(r.depth).toBeGreaterThanOrEqual(1);
  });
});

describe("gambit: ladder", () => {
  it("scores your captures and a win, then levels up with colours swapped", () => {
    const s = newGame();
    expect(s.you).toBe(1);
    // Scholar's mate: you capture f7 with check-mate.
    playAll(s, ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"]);
    expect(s.result).toMatchObject({ kind: "win", why: "mate", points: 300 });
    expect(s.score).toBe(10 + 300); // pawn + win at level 1
    nextGame(s);
    expect(s).toMatchObject({ level: 2, games: 1, you: -1, ply: 0, last: -1, result: null });
    expect(s.pos.turn).toBe(1); // the engine opens as White
  });

  it("resigning ends the run", () => {
    const s = newGame();
    resign(s);
    expect(s.result?.kind).toBe("loss");
    nextGame(s);
    expect(s.games).toBe(0);
  });

  it("survives a snapshot round-trip", () => {
    const s = newGame();
    playAll(s, ["e2e4", "c7c5", "g1f3"]);
    const copy = JSON.parse(JSON.stringify(s)) as GambitState;
    expect(legalMoves(copy.pos)).toEqual(legalMoves(s.pos));
    expect(keyOf(copy.pos)).toBe(keyOf(s.pos));
    play(copy, mv(copy.pos, "d7d6"));
    expect(copy.ply).toBe(4);
    expect(moveOf(sqOf("d7"), sqOf("d6"))).toBe(copy.last);
  });
});
