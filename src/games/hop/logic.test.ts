import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { COLS, HOP_S, hop, makeLane, newGame, step, trainWarning, type HopState, type Lane } from "./logic";

const DT = 1 / 60;
const grass = (): Lane => ({ type: "grass", dir: 1, speed: 0, movers: [], trees: [], train: 0 });
function setup(lane1: Lane): HopState {
  const rng = createRng(1);
  const s = newGame(rng);
  for (let r = -5; r < 30; r++) s.lanes[r] = grass();
  s.lanes[1] = lane1;
  s.cam = -10;
  return s;
}
const land = (s: HopState) => {
  s.hop = 0;
};

describe("hop", () => {
  it("first rows are safe grass", () => {
    const s = newGame(createRng(2));
    for (let r = 0; r < 3; r++) expect(s.lanes[r].type).toBe("grass");
  });

  it("hops one tile; trees and the side edges block", () => {
    const rng = createRng(3);
    const s = setup({ ...grass(), trees: [0] });
    expect(hop(s, "up", rng)).toBe(false);
    expect(hop(s, "right", rng)).toBe(true);
    land(s);
    expect(s.x).toBe(1);
    expect(hop(s, "up", rng)).toBe(true);
    expect(s.row).toBe(1);
    s.x = COLS;
    land(s);
    expect(hop(s, "right", rng)).toBe(false);
  });

  it("a car on your tile squashes you", () => {
    const rng = createRng(4);
    const s = setup({ type: "road", dir: 1, speed: 3, movers: [{ x: -1.2, len: 1.4 }], trees: [], train: 0 });
    hop(s, "up", rng);
    land(s);
    for (let i = 0; i < 60 && s.alive; i++) step(s, DT, rng);
    expect(s.alive).toBe(false);
    expect(s.death).toBe("car");
  });

  it("logs carry you; open water drowns you", () => {
    const rng = createRng(5);
    const s = setup({ type: "river", dir: 1, speed: 2, movers: [{ x: 0, len: 3 }], trees: [], train: 0 });
    hop(s, "up", rng);
    land(s);
    for (let i = 0; i < 30; i++) step(s, DT, rng);
    expect(s.alive).toBe(true);
    expect(s.x).toBeCloseTo(1, 1);
    const t = setup({ type: "river", dir: 1, speed: 2, movers: [{ x: 6, len: 2 }], trees: [], train: 0 });
    hop(t, "up", rng);
    land(t);
    step(t, DT, rng);
    expect(t.death).toBe("water");
  });

  it("a log carrying you off the edge is fatal", () => {
    const rng = createRng(6);
    const s = setup({ type: "river", dir: 1, speed: 3, movers: [{ x: 0, len: 30 }], trees: [], train: 0 });
    hop(s, "up", rng);
    land(s);
    for (let i = 0; i < 60 * 4 && s.alive; i++) step(s, DT, rng);
    expect(s.death).toBe("drift");
  });

  it("trains are announced before they arrive, then sweep the rail", () => {
    const rng = createRng(7);
    const lane: Lane = { type: "rail", dir: 1, speed: 38, movers: [], trees: [], train: 2 };
    const s = setup(lane);
    let warned = false;
    for (let i = 0; i < 60 * 1.9; i++) {
      step(s, DT, rng);
      if (trainWarning(s.lanes[1]) !== null) warned = true;
    }
    expect(warned).toBe(true);
    hop(s, "up", rng);
    land(s);
    for (let i = 0; i < 60 && s.alive; i++) step(s, DT, rng);
    expect(s.death).toBe("train");
  });

  it("standing still too long gets you caught", () => {
    const rng = createRng(8);
    const s = setup(grass());
    s.cam = -2;
    for (let i = 0; i < 60 * 20 && s.alive; i++) step(s, DT, rng);
    expect(s.death).toBe("caught");
  });

  it("score tracks the furthest row; going back doesn't add", () => {
    const rng = createRng(9);
    const s = setup(grass());
    hop(s, "up", rng);
    land(s);
    hop(s, "up", rng);
    land(s);
    hop(s, "down", rng);
    expect(s.best).toBe(2);
  });

  it("generated rivers always have a log within reach and roads leave gaps", () => {
    const rng = createRng(10);
    let prev: Lane | undefined;
    for (let row = 3; row < 400; row++) {
      const l = makeLane(row, prev, rng);
      if (l.type === "river") {
        const xs = l.movers.map((m) => [m.x - m.len / 2, m.x + m.len / 2]).sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < xs.length; i++) expect(xs[i][0] - xs[i - 1][1]).toBeLessThan(3);
      }
      if (l.type === "road") expect(l.movers.reduce((a, m) => a + m.len, 0)).toBeLessThan(14);
      if (l.type === "grass") expect(l.trees.length).toBeLessThanOrEqual(3);
      prev = l;
    }
  });

  it("hops are rate-limited by the hop animation", () => {
    const rng = createRng(11);
    const s = setup(grass());
    expect(hop(s, "up", rng)).toBe(true);
    expect(hop(s, "up", rng)).toBe(false);
    step(s, HOP_S, rng);
    expect(hop(s, "up", rng)).toBe(true);
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(12);
    const s = newGame(a);
    const moves = ["up", "up", "left", "up", "right", "up"] as const;
    for (let i = 0; i < 120; i++) {
      if (i % 20 === 0) hop(s, moves[(i / 20) % moves.length], a);
      step(s, DT, a);
    }
    const copy: HopState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 600; i++) {
      if (i % 25 === 0) {
        hop(s, moves[i % moves.length], a);
        hop(copy, moves[i % moves.length], b);
      }
      step(s, DT, a);
      step(copy, DT, b);
    }
    expect(copy).toEqual(s);
  });
});
