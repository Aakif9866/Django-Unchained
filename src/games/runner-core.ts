/**
 * Shared rules for the lane runners (Ridge Run, Rail Dash). Pure: no DOM, no clock.
 * The runner moves along +z in three lanes (-1, 0, 1). Obstacles come in four kinds:
 *  low   → jump it        high → roll under it
 *  block → change lane    gap  → spans every lane, jump it
 * Generators keep one "safe" lane free of blocks; it only shifts to a neighbouring lane once that lane is clear,
 * so there is always a reachable path.
 */
import type { Rng } from "@/engine/rng";

export type Kind = "low" | "high" | "block" | "gap";
export interface Obstacle {
  id: number;
  lane: number;
  z: number;
  len: number;
  kind: Kind;
  look: number; // which model the renderer uses
}
export interface Pickup {
  id: number;
  lane: number;
  z: number;
  y: number;
  kind: number; // game-specific (0 = coin/gem)
}
export interface RunnerState {
  z: number;
  speed: number;
  lane: number; // target lane
  x: number; // actual lateral position (lanes), eases toward `lane`
  y: number;
  vy: number;
  roll: number; // seconds of roll left
  obstacles: Obstacle[];
  pickups: Pickup[];
  nextId: number;
  genZ: number; // generated up to here
  safe: number; // safe lane for generation
  blockedUntil: number[]; // per lane (index lane+1)
  alive: boolean;
}

export const GRAVITY = 34;
export const JUMP_V = 12;
export const ROLL_S = 0.65;
export const LANE_SPEED = 9; // lanes per second
export const AHEAD = 160;
export const HIT_X = 0.55;

export function newRunner(speed: number): RunnerState {
  return {
    z: 0, speed, lane: 0, x: 0, y: 0, vy: 0, roll: 0, obstacles: [], pickups: [], nextId: 1, genZ: 30, safe: 0,
    blockedUntil: [-1, -1, -1], alive: true,
  };
}

export function steer(s: RunnerState, dir: -1 | 1) {
  if (s.alive) s.lane = Math.max(-1, Math.min(1, s.lane + dir));
}
export function jump(s: RunnerState) {
  if (!s.alive || s.y > 0.05) return false;
  s.vy = JUMP_V;
  s.roll = 0;
  return true;
}
export function roll(s: RunnerState) {
  if (!s.alive) return false;
  s.roll = ROLL_S;
  if (s.y > 0) s.vy = Math.min(s.vy, -JUMP_V * 1.2); // slam down
  return true;
}

export function addObstacle(s: RunnerState, o: Omit<Obstacle, "id">) {
  s.obstacles.push({ ...o, id: s.nextId++ });
  if (o.kind === "block") s.blockedUntil[o.lane + 1] = Math.max(s.blockedUntil[o.lane + 1], o.z + o.len);
}
export function addPickup(s: RunnerState, p: Omit<Pickup, "id">) {
  s.pickups.push({ ...p, id: s.nextId++ });
}
/**
 * Lanes (other than the safe one) where a new block may start at z. While the middle lane is blocked, the side
 * lanes are off-limits too: a runner on the far side couldn't cross the middle to escape.
 */
export const freeLanes = (s: RunnerState, z: number) =>
  [-1, 0, 1].filter((l) => l !== s.safe && s.blockedUntil[l + 1] < z && (l === 0 || s.blockedUntil[1] < z - 6));

/** Move the safe lane by at most one, only into a lane that is clear from z on. */
export function driftSafe(s: RunnerState, z: number, rng: Rng) {
  if (rng.next() < 0.5) return;
  const to = s.safe + (rng.next() < 0.5 ? -1 : 1);
  if (to >= -1 && to <= 1 && s.blockedUntil[to + 1] < z - 2) s.safe = to;
}

export interface StepResult {
  crashed: Obstacle | null;
  picked: Pickup[];
}

/** Advance; `gen` fills the track ahead. */
export function stepRunner(s: RunnerState, dt: number, gen: (s: RunnerState) => void): StepResult {
  const res: StepResult = { crashed: null, picked: [] };
  if (!s.alive) return res;
  const prevZ = s.z;
  s.z += s.speed * dt;
  const d = s.lane - s.x;
  s.x += Math.sign(d) * Math.min(Math.abs(d), LANE_SPEED * dt);
  s.vy -= GRAVITY * dt;
  s.y = Math.max(0, s.y + s.vy * dt);
  if (s.y === 0) s.vy = Math.max(0, s.vy);
  s.roll = Math.max(0, s.roll - dt);

  for (const o of s.obstacles) {
    if (o.z > s.z || o.z + o.len < prevZ) continue;
    const inLane = o.kind === "gap" || Math.abs(s.x - o.lane) < HIT_X;
    if (!inLane) continue;
    const ok =
      o.kind === "low" ? s.y > 0.9 : o.kind === "high" ? s.roll > 0 && s.y < 0.6 : o.kind === "gap" ? s.y > 0.2 : false;
    if (!ok) {
      res.crashed = o;
      s.alive = false;
      return res;
    }
  }
  s.pickups = s.pickups.filter((p) => {
    const hit = p.z <= s.z + 0.6 && p.z >= prevZ - 0.6 && Math.abs(s.x - p.lane) < 0.7 && Math.abs(s.y - p.y) < 1.4;
    if (hit) res.picked.push(p);
    return !hit && p.z > s.z - 5;
  });
  s.obstacles = s.obstacles.filter((o) => o.z + o.len > s.z - 10);
  while (s.genZ < s.z + AHEAD) gen(s);
  return res;
}
