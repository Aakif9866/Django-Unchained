/**
 * Ridge Run rules: a gentle cliff-top run. Rocks to dodge, logs to hop, branches to duck, gaps to leap, gems to grab.
 * Built on runner-core. The path's bends and hills are visual only (see `bend`), so the rules stay simple.
 */
import type { Rng } from "@/engine/rng";
import { addObstacle, addPickup, driftSafe, freeLanes, jump, newRunner, roll, steer, stepRunner, type RunnerState } from "../runner-core";

export const LOOK = { rock: 0, log: 1, branch: 2, gap: 3 } as const;
export interface RidgeState {
  r: RunnerState;
  gems: number;
  t: number;
  score: number;
}
export type Event = "gem" | "crash";

export const speedAt = (t: number) => 11 + Math.min(9, t * 0.06);
/** Visual path: lateral bend and height at distance z. */
export const bend = (z: number) => ({ x: Math.sin(z / 70) * 9 + Math.sin(z / 23) * 2, y: Math.sin(z / 50) * 2.5 });

export function gen(s: RunnerState, rng: Rng) {
  const z = s.genZ;
  driftSafe(s, z, rng);
  const r = rng.next();
  if (r < 0.15 && Math.max(...s.blockedUntil) < z - 4) {
    // Gaps stand alone so a leap is the only decision.
    addObstacle(s, { lane: 0, z, len: 3.2, kind: "gap", look: LOOK.gap });
    s.genZ = z + 16 + rng.next() * 6;
    return;
  }
  if (r < 0.55) {
    const free = freeLanes(s, z);
    if (free.length) addObstacle(s, { lane: rng.pick(free), z, len: 1.4, kind: "block", look: LOOK.rock });
    if (free.length > 1 && rng.next() < 0.3) addObstacle(s, { lane: free.find((l) => l !== free[0])!, z: z + 5, len: 1.4, kind: "block", look: LOOK.rock });
  } else if (r < 0.78) addObstacle(s, { lane: rng.int(-1, 1), z, len: 0.8, kind: "low", look: LOOK.log });
  else addObstacle(s, { lane: rng.int(-1, 1), z, len: 1, kind: "high", look: LOOK.branch });
  if (rng.next() < 0.6) {
    const lane = s.safe;
    for (let i = 0; i < 4; i++) addPickup(s, { lane, z: z + 3 + i * 2, y: 0.8, kind: 0 });
  }
  s.genZ = z + 15 + rng.next() * 8;
}

export function newGame(): RidgeState {
  return { r: newRunner(speedAt(0)), gems: 0, t: 0, score: 0 };
}

export { jump, roll, steer };

export function step(s: RidgeState, dt: number, rng: Rng): Event[] {
  const ev: Event[] = [];
  if (!s.r.alive) return ev;
  s.t += dt;
  s.r.speed = speedAt(s.t);
  const res = stepRunner(s.r, dt, (r) => gen(r, rng));
  s.gems += res.picked.length;
  if (res.picked.length) ev.push("gem");
  if (res.crashed) ev.push("crash");
  s.score = Math.floor(s.r.z / 2) + s.gems * 10;
  return ev;
}
