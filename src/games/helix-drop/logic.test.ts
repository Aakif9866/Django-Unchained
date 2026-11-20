import { describe, expect, it } from "vitest";
import { createRng } from "@/engine/rng";
import { GAP_Y, SLICES, SMASH_COMBO, makeRing, newGame, ringsFor, rotate, sliceUnderBall, step, type HelixState, type Slice } from "./logic";

const DT = 1 / 60;
const angleFor = (slice: number) => -((slice + 0.5) / SLICES) * Math.PI * 2;
const ring = (slices: Slice[]) => ({ slices, broken: false });
const all = (c: Slice): Slice[] => Array(SLICES).fill(c);
/** Bot: rotate so the next ring's gap is under the ball. */
function bot(s: HelixState) {
  const r = s.rings[s.next];
  if (!r) return;
  const g = r.slices.indexOf("g");
  s.theta = angleFor(g);
}

describe("helix drop", () => {
  it("maps rotation to the slice under the ball", () => {
    for (let k = 0; k < SLICES; k++) expect(sliceUnderBall(angleFor(k))).toBe(k);
    expect(sliceUnderBall(angleFor(3) + Math.PI * 4)).toBe(3);
  });

  it("every ring has a gap; the first ring has no danger", () => {
    const rng = createRng(1);
    for (let level = 0; level < 6; level++)
      for (let i = 0; i < 30; i++) {
        const r = makeRing(i, level, rng);
        expect(r.slices).toContain("g");
        if (i === 0) expect(r.slices).not.toContain("d");
      }
  });

  it("starts with the first gap away from the ball", () => {
    const s = newGame(createRng(2));
    expect(s.rings[0].slices[sliceUnderBall(s.theta)]).not.toBe("g");
  });

  it("safe slices bounce, gaps let you through and score", () => {
    const rng = createRng(3);
    const s = newGame(rng);
    s.rings = [ring(all("s")), ring(all("g")), ring(all("s"))];
    let ev: string[] = [];
    for (let i = 0; i < 60 && !ev.includes("bounce"); i++) ev = step(s, DT, rng);
    expect(ev).toContain("bounce");
    expect(s.vy).toBeGreaterThan(0);
    s.rings[0] = ring(all("g"));
    const got: string[] = [];
    for (let i = 0; i < 120; i++) got.push(...step(s, DT, rng));
    expect(got.filter((e) => e === "pass")).toHaveLength(2);
    expect(s.score).toBe(1 + 2);
  });

  it("landing on danger ends the run", () => {
    const rng = createRng(4);
    const s = newGame(rng);
    s.rings = [ring(all("d"))];
    let ev: string[] = [];
    for (let i = 0; i < 60 && s.alive; i++) ev = step(s, DT, rng);
    expect(ev).toContain("dead");
  });

  it(`falling through ${SMASH_COMBO} rings smashes even a danger ring`, () => {
    const rng = createRng(5);
    const s = newGame(rng);
    s.rings = [ring(all("g")), ring(all("g")), ring(all("g")), ring(all("d")), ring(all("s"))];
    const ev: string[] = [];
    for (let i = 0; i < 180 && s.alive; i++) ev.push(...step(s, DT, rng));
    expect(ev).toContain("smash");
    expect(s.alive).toBe(true);
    expect(s.rings[3].broken).toBe(true);
  });

  it("reaching the bottom completes the level and builds a taller tower", () => {
    const rng = createRng(6);
    const s = newGame(rng);
    const ev: string[] = [];
    for (let i = 0; i < 60 * 60 && !ev.includes("level"); i++) {
      bot(s);
      ev.push(...step(s, DT, rng));
    }
    expect(ev).toContain("level");
    for (let i = 0; i < 90; i++) step(s, DT, rng);
    expect(s.level).toBe(1);
    expect(s.rings).toHaveLength(ringsFor(1));
    expect(s.y).toBeGreaterThan(0);
  });

  it("can't rotate after death", () => {
    const s = newGame(createRng(7));
    s.alive = false;
    const t = s.theta;
    rotate(s, 1);
    expect(s.theta).toBe(t);
  });

  it("ball never passes a ring it bounced on", () => {
    const rng = createRng(8);
    const s = newGame(rng);
    s.rings = [ring(all("s"))];
    for (let i = 0; i < 600; i++) {
      step(s, DT, rng);
      expect(s.y).toBeGreaterThanOrEqual(-1e-9 - 0 * GAP_Y);
    }
  });

  it("snapshot round-trip plays identically", () => {
    const a = createRng(9);
    const s = newGame(a);
    for (let i = 0; i < 200; i++) {
      bot(s);
      step(s, DT, a);
    }
    const copy: HelixState = JSON.parse(JSON.stringify(s));
    const b = createRng(0);
    b.setState(a.state());
    for (let i = 0; i < 1500; i++) {
      bot(s);
      bot(copy);
      step(s, DT, a);
      step(copy, DT, b);
    }
    expect(copy).toEqual(s);
  });
});
