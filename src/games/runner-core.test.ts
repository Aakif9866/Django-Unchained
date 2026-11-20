import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "@/engine/rng";
import { jump, newRunner, roll, steer, stepRunner, type RunnerState } from "./runner-core";
import * as dash from "./rail-dash/logic";
import * as ridge from "./ridge-run/logic";

const DT = 1 / 60;
const none = () => {};
const at = (s: RunnerState) => {
  s.genZ = 1e9; // no generation in unit setups
  return s;
};

/** A careful bot: reads a few units ahead, dodges blocks, jumps lows and gaps, rolls highs. */
function bot(s: RunnerState) {
  const ahead = (lane: number, from: number, to: number) =>
    s.obstacles.filter((o) => o.z + o.len > s.z + from && o.z < s.z + to && (o.kind === "gap" || o.lane === lane));
  // Distance to the next block in a lane (looking as far ahead as a player can see).
  const clear = (lane: number) => {
    const b = ahead(lane, -0.5, 40).filter((o) => o.kind === "block");
    return b.length ? Math.min(...b.map((o) => o.z)) - s.z : 99;
  };
  if (Math.abs(s.x - s.lane) < 0.05 && clear(s.lane) < 30) {
    const options = [s.lane - 1, s.lane + 1].filter((l) => l >= -1 && l <= 1 && clear(l) > clear(s.lane) + 1 && clear(l) > 0.5);
    if (options.length) steer(s, ((options.sort((a, b) => clear(b) - clear(a))[0]) - s.lane) as -1 | 1);
  }
  const near = ahead(Math.round(s.x), 0, s.speed * 0.28);
  if (near.some((o) => o.kind === "low" || o.kind === "gap")) jump(s);
  else if (ahead(Math.round(s.x), 0, s.speed * 0.12).some((o) => o.kind === "high")) roll(s);
}

describe("runner core", () => {
  it("a low barrier crashes you unless you jump it", () => {
    const s = at(newRunner(15));
    s.obstacles = [{ id: 1, lane: 0, z: 5, len: 0.6, kind: "low", look: 0 }];
    for (let i = 0; i < 40 && s.alive; i++) stepRunner(s, DT, none);
    expect(s.alive).toBe(false);
    const t = at(newRunner(15));
    t.obstacles = [{ id: 1, lane: 0, z: 5, len: 0.6, kind: "low", look: 0 }];
    for (let i = 0; i < 60 && t.alive; i++) {
      if (t.z > 2.5) jump(t);
      stepRunner(t, DT, none);
    }
    expect(t.alive).toBe(true);
  });

  it("a high barrier needs a roll", () => {
    const s = at(newRunner(15));
    s.obstacles = [{ id: 1, lane: 0, z: 5, len: 1.2, kind: "high", look: 0 }];
    for (let i = 0; i < 60 && s.alive; i++) {
      if (s.z > 3) roll(s);
      stepRunner(s, DT, none);
    }
    expect(s.alive).toBe(true);
  });

  it("a block can only be dodged by changing lane", () => {
    const s = at(newRunner(15));
    s.obstacles = [{ id: 1, lane: 0, z: 6, len: 4, kind: "block", look: 0 }];
    jump(s);
    for (let i = 0; i < 60 && s.alive; i++) stepRunner(s, DT, none);
    expect(s.alive).toBe(false);
    const t = at(newRunner(15));
    t.obstacles = [{ id: 1, lane: 0, z: 6, len: 4, kind: "block", look: 0 }];
    steer(t, 1);
    for (let i = 0; i < 60 && t.alive; i++) stepRunner(t, DT, none);
    expect(t.alive).toBe(true);
    expect(t.x).toBe(1);
  });

  it("lanes are clamped; jumping mid-air does nothing; rolling mid-air slams down", () => {
    const s = at(newRunner(10));
    steer(s, -1);
    steer(s, -1);
    expect(s.lane).toBe(-1);
    expect(jump(s)).toBe(true);
    stepRunner(s, DT, none);
    expect(jump(s)).toBe(false);
    roll(s);
    expect(s.vy).toBeLessThan(0);
  });

  it("pickups are collected when you pass through them", () => {
    const s = at(newRunner(15));
    s.pickups = [{ id: 1, lane: 0, z: 3, y: 0.5, kind: 0 }, { id: 2, lane: 1, z: 3, y: 0.5, kind: 0 }];
    let got = 0;
    for (let i = 0; i < 30; i++) got += stepRunner(s, DT, none).picked.length;
    expect(got).toBe(1);
  });

  const games: [string, (rng: Rng) => { r: RunnerState }, (s: never, dt: number, rng: Rng) => unknown][] = [
    ["rail dash", () => dash.newGame(), dash.step as never],
    ["ridge run", () => ridge.newGame(), ridge.step as never],
  ];
  for (const [name, make, step] of games) {
    it(`${name}: generated track always leaves a lane without blocks`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const rng = createRng(seed);
        const s = make(rng);
        for (let i = 0; i < 60 * 40; i++) {
          s.r.y = 1.5; // fly over everything: we're only checking layout here
          s.r.vy = 0;
          step(s as never, DT, rng);
        }
        for (let z = 30; z < s.r.genZ; z += 0.5) {
          const blocked = new Set(s.r.obstacles.filter((o) => o.kind === "block" && o.z <= z && o.z + o.len >= z).map((o) => o.lane));
          expect(blocked.size).toBeLessThan(3);
        }
      }
    });

    it(`${name}: a careful bot survives a long run on several seeds`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const rng = createRng(seed);
        const s = make(rng);
        for (let i = 0; i < 60 * 60 && s.r.alive; i++) {
          bot(s.r);
          step(s as never, DT, rng);
        }
        expect(s.r.alive, `seed ${seed} crashed at z=${s.r.z.toFixed(1)}`).toBe(true);
        expect(s.r.z).toBeGreaterThan(700);
      }
    });

    it(`${name}: snapshot round-trip plays identically`, () => {
      const a = createRng(9);
      const s = make(a);
      for (let i = 0; i < 300; i++) {
        bot(s.r);
        step(s as never, DT, a);
      }
      const copy = JSON.parse(JSON.stringify(s));
      const b = createRng(0);
      b.setState(a.state());
      for (let i = 0; i < 900; i++) {
        bot(s.r);
        bot(copy.r);
        step(s as never, DT, a);
        step(copy as never, DT, b);
      }
      expect(copy).toEqual(s);
    });
  }

  it("rail dash: coins count, the magnet pulls coins from other lanes", () => {
    const rng = createRng(3);
    const s = dash.newGame();
    s.r.genZ = 1e9;
    s.r.pickups = [{ id: 1, lane: 0, z: 2, y: 0.5, kind: dash.MAGNET }, { id: 2, lane: 1, z: 8, y: 0.5, kind: dash.COIN }];
    const ev: string[] = [];
    for (let i = 0; i < 60; i++) ev.push(...(dash.step(s, DT, rng) as string[]));
    expect(ev).toContain("magnet");
    expect(ev).toContain("coin");
    expect(s.coins).toBe(1);
  });

  it("speeds ramp and cap", () => {
    expect(dash.speedAt(1000)).toBe(30);
    expect(ridge.speedAt(1000)).toBe(20);
    expect(ridge.speedAt(0)).toBeLessThan(dash.speedAt(0));
  });
});
