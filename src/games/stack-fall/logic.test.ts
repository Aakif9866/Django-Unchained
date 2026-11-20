import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import {
  COLS, KINDS, LOCK_DELAY, MAX_RESETS, ROWS, cellsOf, fits, ghostY, gravity, hardDrop, hold, newGame, rotate, shift,
  softDrop, step, type Kind, type StackState,
} from "./logic";

const sorted = (cs: readonly (readonly [number, number])[]) => cs.map(([x, y]) => `${x},${y}`).sort();
function withPiece(k: Kind, seed = 1): StackState {
  const s = newGame(createRng(seed));
  s.cur = { k, r: 0, x: k === "O" ? 4 : 3, y: 1 };
  return s;
}
const fill = (s: StackState, y: number, except: number[] = []) => {
  for (let x = 0; x < COLS; x++) s.board[y * COLS + x] = except.includes(x) ? 0 : 1;
};

describe("stack fall", () => {
  it("7-bag: every group of 7 pieces contains each kind once", () => {
    const rng = createRng(3);
    const s = newGame(rng);
    const seen: Kind[] = [s.cur.k];
    while (seen.length < 70) {
      seen.push(s.bag[0]);
      hold(s, rng); // cycles pieces without placing
      s.canHold = true;
      if (s.hold) s.hold = null;
    }
    for (let i = 0; i < 70; i += 7) expect([...seen.slice(i, i + 7)].sort()).toEqual([...KINDS].sort());
  });

  it("T rotates clockwise through four states and back to the start", () => {
    const s = withPiece("T");
    const start = sorted(cellsOf(s.cur));
    for (let i = 0; i < 4; i++) expect(rotate(s)).toBe(true);
    expect(s.cur.r).toBe(0);
    expect(sorted(cellsOf(s.cur))).toEqual(start);
  });

  it("O never rotates", () => {
    const s = withPiece("O");
    expect(rotate(s)).toBe(false);
  });

  it("wall kick: a vertical I against the right wall kicks left when rotated flat", () => {
    const s = withPiece("I");
    rotate(s); // state 1: vertical in column x+2
    while (shift(s, 1));
    expect(Math.max(...cellsOf(s.cur).map(([x]) => x))).toBe(COLS - 1);
    expect(rotate(s)).toBe(true); // 1>2 needs a kick
    const xs = cellsOf(s.cur).map(([x]) => x);
    expect(Math.max(...xs)).toBe(COLS - 1);
    expect(Math.min(...xs)).toBe(COLS - 4);
  });

  it("wall kick: T pointing right against the left wall kicks one column right when rotated", () => {
    const s = withPiece("T");
    s.cur = { k: "T", r: 1, x: -1, y: 5 }; // stem in column 0
    expect(fits(s.board, s.cur)).toBe(true);
    expect(rotate(s)).toBe(true); // 1>2: test 1 would poke into column −1, test 2 (+1, 0) fits
    expect(s.cur).toMatchObject({ r: 2, x: 0, y: 5 });
  });

  it("floor kick: rotation fails only when every kick is blocked", () => {
    const s = withPiece("T");
    for (let y = 3; y < ROWS; y++) fill(s, y, [3, 4, 5]); // a 3-wide shaft
    s.cur = { k: "T", r: 0, x: 3, y: ROWS - 2 };
    s.cur.y = ghostY(s);
    for (let y = 0; y < ROWS; y++) for (const x of [3, 4, 5]) if (!cellsOf(s.cur).some(([cx, cy]) => cx === x && cy === y) && y > 2) s.board[y * COLS + x] = 1;
    expect(rotate(s)).toBe(false);
    expect(s.cur.r).toBe(0);
  });

  it("collision: can't move through walls or stack", () => {
    const s = withPiece("O");
    while (shift(s, -1));
    expect(Math.min(...cellsOf(s.cur).map(([x]) => x))).toBe(0);
    expect(shift(s, -1)).toBe(false);
  });

  it("gravity pulls the piece down over time and speeds up with level", () => {
    const rng = createRng(1);
    const s = withPiece("T");
    const y0 = s.cur.y;
    step(s, gravity(1) * 2.5, rng);
    expect(s.cur.y).toBe(y0 + 2);
    expect(gravity(10)).toBeLessThan(gravity(1));
    expect(gravity(99)).toBe(0.03);
  });

  it("lock delay: piece locks only after resting LOCK_DELAY, moves reset it up to a cap", () => {
    const rng = createRng(1);
    const s = withPiece("T");
    s.cur.y = ghostY(s);
    const first = s.cur.k;
    expect(step(s, LOCK_DELAY * 0.8, rng)).toBeNull();
    shift(s, 1); // resets lock timer
    expect(step(s, LOCK_DELAY * 0.8, rng)).toBeNull();
    for (let i = 0; i < MAX_RESETS + 5; i++) shift(s, i % 2 ? 1 : -1);
    expect(s.resets).toBe(MAX_RESETS);
    const res = step(s, LOCK_DELAY, rng);
    expect(res).not.toBeNull();
    expect(s.board.some((c) => c === KINDS.indexOf(first) + 1)).toBe(true);
  });

  it("ghost shows the landing row; hard drop lands there, scores 2 per cell", () => {
    const s = withPiece("I");
    const g = ghostY(s);
    const dist = g - s.cur.y;
    const before = s.score;
    hardDrop(s, createRng(1));
    expect(s.board.slice((ROWS - 1) * COLS + 3, (ROWS - 1) * COLS + 7).every((c) => c === 1)).toBe(true);
    expect(s.score - before).toBe(dist * 2);
  });

  it("soft drop moves one row and scores 1", () => {
    const s = withPiece("T");
    const y = s.cur.y;
    expect(softDrop(s)).toBe(true);
    expect(s.cur.y).toBe(y + 1);
    expect(s.score).toBe(1);
  });

  it("clearing lines: removes full rows, shifts above down, scores by count × level", () => {
    const rng = createRng(1);
    const s = withPiece("I");
    for (let y = ROWS - 4; y < ROWS; y++) fill(s, y, [0]);
    s.board[(ROWS - 5) * COLS + 5] = 3; // a marker above the stack
    s.cur = { k: "I", r: 1, x: -2, y: 0 }; // vertical I in column 0
    expect(fits(s.board, s.cur)).toBe(true);
    const c = hardDrop(s, rng);
    expect(c.rows).toHaveLength(4);
    expect(c.points).toBe(800);
    expect(s.lines).toBe(4);
    expect(s.board[(ROWS - 1) * COLS + 5]).toBe(3); // marker fell 4 rows
    expect(s.board.filter((v) => v).length).toBe(1);
  });

  it("level goes up every 10 lines and multiplies line points", () => {
    const rng = createRng(1);
    const s = withPiece("I");
    s.lines = 9;
    fill(s, ROWS - 1, [0, 1, 2, 3]);
    s.cur = { k: "I", r: 0, x: 0, y: 1 };
    hardDrop(s, rng);
    expect(s.level).toBe(2);
    expect(s.lines).toBe(10);
  });

  it("hold swaps once per piece and resets after a lock", () => {
    const rng = createRng(2);
    const s = newGame(rng);
    const a = s.cur.k;
    const nextUp = s.bag[0];
    expect(hold(s, rng)).toBe(true);
    expect(s.hold).toBe(a);
    expect(s.cur.k).toBe(nextUp);
    expect(hold(s, rng)).toBe(false);
    hardDrop(s, rng);
    expect(s.canHold).toBe(true);
    expect(hold(s, rng)).toBe(true);
    expect(s.cur.k).toBe(a);
  });

  it("game over when a new piece can't spawn", () => {
    const rng = createRng(1);
    const s = withPiece("T");
    for (let y = 2; y < ROWS; y++) fill(s, y, [y % COLS]); // full of holes, no full lines
    s.cur.y = ghostY(s);
    hardDrop(s, rng);
    expect(s.alive).toBe(false);
    expect(step(s, 1, rng)).toBeNull();
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(11);
    const s = newGame(a);
    for (let i = 0; i < 6; i++) {
      shift(s, i % 3 - 1);
      rotate(s);
      hardDrop(s, a);
    }
    const copy: StackState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 20; i++)
      for (const [st, r] of [[s, a], [copy, b]] as const) {
        shift(st, (i % 5) - 2);
        rotate(st, i % 2 ? 1 : -1);
        step(st, 0.3, r);
        hardDrop(st, r);
      }
    expect(copy).toEqual(s);
  });
});
