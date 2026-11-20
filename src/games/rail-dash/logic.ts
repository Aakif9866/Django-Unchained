/** Rail Dash rules: three-lane dash past trains and barriers, coins and a magnet. Built on runner-core. */
import type { Rng } from "@/engine/rng";
import { addObstacle, addPickup, driftSafe, freeLanes, jump, newRunner, roll, steer, stepRunner, type RunnerState } from "../runner-core";

export const LOOK = { train: 0, low: 1, high: 2, crate: 3 } as const;
export const COIN = 0;
export const MAGNET = 1;
export const MAGNET_S = 10;

export interface DashState {
  r: RunnerState;
  coins: number;
  magnet: number;
  t: number;
  score: number;
}
export type Event = "coin" | "magnet" | "crash";

export const speedAt = (t: number) => 14 + Math.min(16, t * 0.12);

export function gen(s: RunnerState, rng: Rng) {
  const z = s.genZ;
  driftSafe(s, z, rng);
  const roll1 = rng.next();
  const free = freeLanes(s, z);
  if (roll1 < 0.35 && free.length) {
    const lane = rng.pick(free);
    addObstacle(s, { lane, z, len: 16 + rng.int(0, 3) * 7, kind: "block", look: LOOK.train });
    // A follow-up crate only when it can't trap you behind the train: train on a side, crate in the middle.
    if (lane !== 0 && s.safe !== 0 && s.blockedUntil[1] < z && rng.next() < 0.4)
      addObstacle(s, { lane: 0, z: z + 6, len: 1, kind: "block", look: LOOK.crate });
  } else if (roll1 < 0.6) {
    const lane = rng.int(-1, 1);
    if (s.blockedUntil[lane + 1] < z) addObstacle(s, { lane, z, len: 0.6, kind: "low", look: LOOK.low });
  } else if (roll1 < 0.8) {
    const lane = rng.int(-1, 1);
    if (s.blockedUntil[lane + 1] < z) addObstacle(s, { lane, z, len: 1.2, kind: "high", look: LOOK.high });
  } else if (free.length) addObstacle(s, { lane: rng.pick(free), z, len: 1, kind: "block", look: LOOK.crate });

  // Coins mostly trace the safe lane, so following them is a decent strategy.
  if (rng.next() < 0.7) for (let i = 0; i < 6; i++) addPickup(s, { lane: s.safe, z: z + 2 + i * 1.6, y: 0.5, kind: COIN });
  if (rng.next() < 0.04) addPickup(s, { lane: s.safe, z: z + 8, y: 0.6, kind: MAGNET });
  s.genZ = z + 13 + rng.next() * 6;
}

export function newGame(): DashState {
  return { r: newRunner(speedAt(0)), coins: 0, magnet: 0, t: 0, score: 0 };
}

export { jump, roll, steer };

export function step(s: DashState, dt: number, rng: Rng): Event[] {
  const ev: Event[] = [];
  if (!s.r.alive) return ev;
  s.t += dt;
  s.r.speed = speedAt(s.t);
  s.magnet = Math.max(0, s.magnet - dt);
  if (s.magnet > 0)
    for (const p of s.r.pickups)
      if (p.kind === COIN && p.z - s.r.z < 14) {
        // Pull coins toward the runner.
        p.lane += (s.r.x - p.lane) * Math.min(1, dt * 10);
        p.y += (s.r.y + 0.5 - p.y) * Math.min(1, dt * 10);
      }
  const res = stepRunner(s.r, dt, (r) => gen(r, rng));
  for (const p of res.picked)
    if (p.kind === COIN) {
      s.coins++;
      ev.push("coin");
    } else {
      s.magnet = MAGNET_S;
      ev.push("magnet");
    }
  if (res.crashed) ev.push("crash");
  s.score = Math.floor(s.r.z / 2) + s.coins * 5;
  return ev;
}
