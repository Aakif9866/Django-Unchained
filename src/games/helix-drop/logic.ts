/**
 * Helix Drop rules. Pure: no DOM, no clock. A tower of rings, each split into 12 slices: gap / safe / danger.
 * You rotate the tower; the ball bounces at a fixed spot. Falling through a gap scores; landing on safe bounces;
 * landing on danger ends the run, unless you've fallen through 3+ rings in a row, which smashes the ring.
 */
import type { Rng } from "@/engine/rng";

export const SLICES = 12;
export const GAP_Y = 4; // distance between rings
export const GRAVITY = 34;
export const BOUNCE = 12.5;
export const SMASH_COMBO = 3;
export type Slice = "g" | "s" | "d";
export interface Ring {
  slices: Slice[];
  broken: boolean;
}
export interface HelixState {
  level: number;
  rings: Ring[];
  theta: number; // tower rotation
  y: number; // ball height; ring i sits at y = -i * GAP_Y
  vy: number;
  next: number; // index of the next ring below the ball
  combo: number;
  score: number;
  alive: boolean;
  cleared: number; // seconds of the level-complete pause
}
export type Event = "bounce" | "pass" | "smash" | "dead" | "level";

export const ringsFor = (level: number) => Math.min(40, 12 + level * 3);

export function makeRing(i: number, level: number, rng: Rng): Ring {
  const slices: Slice[] = Array(SLICES).fill("s");
  const gap = 2 + (rng.next() < 0.4 ? 1 : 0);
  const at = rng.int(0, SLICES - 1);
  for (let k = 0; k < gap; k++) slices[(at + k) % SLICES] = "g";
  if (i > 0) {
    const danger = Math.min(5, Math.floor(rng.next() * (1 + level * 0.6 + i / 8)));
    for (let k = 0; k < danger; k++) {
      const j = rng.int(0, SLICES - 1);
      if (slices[j] === "s") slices[j] = "d";
    }
  }
  return { slices, broken: false };
}

function buildLevel(s: HelixState, rng: Rng) {
  s.rings = [];
  for (let i = 0; i < ringsFor(s.level); i++) s.rings.push(makeRing(i, s.level, rng));
  // Start above the first ring with its gap rotated away from the ball, so the first move is yours.
  s.y = 2;
  s.vy = 0;
  s.next = 0;
  s.combo = 0;
  const g = s.rings[0].slices.indexOf("g");
  const opposite = (g + SLICES / 2) % SLICES; // the slice across the tower from the gap
  s.theta = -((opposite + 0.5) / SLICES) * Math.PI * 2;
}

export function newGame(rng: Rng): HelixState {
  const s: HelixState = { level: 0, rings: [], theta: 0, y: 2, vy: 0, next: 0, combo: 0, score: 0, alive: true, cleared: 0 };
  buildLevel(s, rng);
  return s;
}

/** Which slice of the tower sits under the ball (the ball is fixed at world angle 0). */
export function sliceUnderBall(theta: number): number {
  const a = (((-theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
  return Math.floor(a * SLICES) % SLICES;
}

export function rotate(s: HelixState, d: number) {
  if (s.alive && s.cleared <= 0) s.theta += d;
}

export function step(s: HelixState, dt: number, rng: Rng): Event[] {
  const ev: Event[] = [];
  if (!s.alive) return ev;
  if (s.cleared > 0) {
    s.cleared -= dt;
    if (s.cleared <= 0) buildLevel(s, rng);
    return ev;
  }
  const prevY = s.y;
  s.vy -= GRAVITY * dt;
  s.y += s.vy * dt;
  while (s.next < s.rings.length) {
    const ringY = -s.next * GAP_Y;
    if (!(prevY > ringY && s.y <= ringY)) break;
    const ring = s.rings[s.next];
    const sl = ring.broken ? "g" : ring.slices[sliceUnderBall(s.theta)];
    if (sl === "g") {
      s.combo++;
      s.score += s.combo;
      s.next++;
      ev.push("pass");
      continue;
    }
    if (s.combo >= SMASH_COMBO) {
      ring.broken = true;
      s.score += s.combo * 2;
      s.combo = 0;
      s.next++;
      s.vy = BOUNCE * 0.6;
      s.y = ringY;
      ev.push("smash");
      break;
    }
    if (sl === "d") {
      s.alive = false;
      s.y = ringY;
      ev.push("dead");
      return ev;
    }
    s.y = ringY;
    s.vy = BOUNCE;
    s.combo = 0;
    ev.push("bounce");
    break;
  }
  // Bottom platform: level complete.
  const floor = -s.rings.length * GAP_Y;
  if (s.y <= floor) {
    s.y = floor;
    s.vy = BOUNCE;
    s.score += 10 * (s.level + 1);
    s.level++;
    s.cleared = 1;
    ev.push("level");
  }
  return ev;
}
