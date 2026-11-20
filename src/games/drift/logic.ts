/**
 * Drift rules. Pure: no DOM, no clock. A closed spline track, arcade car physics with real slip: lateral grip
 * drops when you steer hard at speed, so the car slides. Grass slows you, a barrier stops you wandering off.
 * Three-lap time attack; your best lap is recorded as a ghost to race against.
 */

export type P = [number, number];
export const CONTROL: P[] = [
  [0, 0], [40, -6], [70, 4], [86, 26], [74, 48], [48, 52], [36, 70], [8, 78], [-22, 70], [-34, 46], [-20, 28], [-30, 8],
];
export const WIDTH = 10;
export const BARRIER = 9; // beyond the track edge
export const LAPS = 3;
export const SAMPLES = 240;
export const CHECKPOINTS = 8;
export const MAX_ON = 46;
export const MAX_OFF = 17;
export const ACCEL = 26;
export const GHOST_DT = 0.1;

/** Closed Catmull-Rom spline through the control points. */
export function buildTrack(ctrl: P[] = CONTROL, n = SAMPLES): P[] {
  const out: P[] = [];
  const m = ctrl.length;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * m;
    const k = Math.floor(t);
    const u = t - k;
    const p0 = ctrl[(k - 1 + m) % m];
    const p1 = ctrl[k % m];
    const p2 = ctrl[(k + 1) % m];
    const p3 = ctrl[(k + 2) % m];
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
    out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}
export const TRACK = buildTrack();

/** Nearest centreline sample and the distance to it (searching near a hint keeps it cheap and stable). */
export function nearest(x: number, y: number, hint = -1): { i: number; d: number } {
  let best = { i: 0, d: Infinity };
  const scan = (i: number) => {
    const j = ((i % SAMPLES) + SAMPLES) % SAMPLES;
    const d = Math.hypot(TRACK[j][0] - x, TRACK[j][1] - y);
    if (d < best.d) best = { i: j, d };
  };
  if (hint < 0) for (let i = 0; i < SAMPLES; i++) scan(i);
  else for (let k = -25; k <= 25; k++) scan(hint + k);
  return best;
}

export interface Car {
  x: number;
  y: number;
  h: number; // heading
  vx: number;
  vy: number;
}
export interface DriftState {
  car: Car;
  steer: number; // -1..1
  brake: boolean;
  seg: number; // nearest track sample
  cp: number; // next checkpoint index (1..CHECKPOINTS, 0 = finish line)
  lap: number; // completed laps
  t: number; // race time
  lapStart: number;
  laps: number[];
  rec: number[]; // current lap ghost samples x,y,h,…
  recClock: number;
  ghost: number[] | null; // best lap samples
  bestLap: number | null;
  drifting: boolean;
  offTrack: boolean;
  countdown: number;
  done: boolean;
  score: number;
}
export type Event = "lap" | "best" | "done" | "bump";

export function newGame(ghost: number[] | null = null, bestLap: number | null = null): DriftState {
  const [x, y] = TRACK[0];
  const [nx, ny] = TRACK[1];
  return {
    car: { x, y, h: Math.atan2(ny - y, nx - x), vx: 0, vy: 0 }, steer: 0, brake: false, seg: 0, cp: 1, lap: 0, t: 0, lapStart: 0,
    laps: [], rec: [], recClock: 0, ghost, bestLap, drifting: false, offTrack: false, countdown: 1.5, done: false, score: 0,
  };
}

export const raceScore = (total: number) => Math.max(100, Math.round(20000 - total * 120));

export function step(s: DriftState, dt: number): Event[] {
  const ev: Event[] = [];
  if (s.done) return ev;
  if (s.countdown > 0) {
    s.countdown -= dt;
    return ev;
  }
  s.t += dt;
  const c = s.car;
  const fx = Math.cos(c.h);
  const fy = Math.sin(c.h);
  let fwd = c.vx * fx + c.vy * fy;
  let lat = -c.vx * fy + c.vy * fx;
  const prevSeg = s.seg;
  const near = nearest(c.x, c.y, s.seg);
  s.seg = near.i;
  s.offTrack = near.d > WIDTH / 2;
  const max = s.offTrack ? MAX_OFF : MAX_ON;

  // Throttle is automatic (one thumb!); braking only when asked.
  if (s.brake) fwd -= ACCEL * 1.6 * dt;
  else if (fwd < max) fwd += ACCEL * dt * (1 - fwd / (max * 1.15));
  if (fwd > max) fwd -= (fwd - max) * Math.min(1, dt * 2.5);
  fwd = Math.max(0, fwd);
  // Steering authority grows with speed, eases at the top end.
  const sp = Math.abs(fwd);
  c.h += s.steer * 2.5 * Math.min(1, sp / 12) * (1 - 0.25 * (sp / MAX_ON)) * dt;
  // Grip: hard steering at speed breaks traction and the car slides.
  s.drifting = Math.abs(s.steer) > 0.7 && sp > MAX_ON * 0.6 && !s.offTrack;
  const grip = s.offTrack ? 5 : s.drifting ? 2.2 : 9;
  lat *= Math.exp(-grip * dt);
  // Re-project onto the new heading.
  const nfx = Math.cos(c.h);
  const nfy = Math.sin(c.h);
  c.vx = nfx * fwd - nfy * lat;
  c.vy = nfy * fwd + nfx * lat;
  c.x += c.vx * dt;
  c.y += c.vy * dt;

  // Barrier: push back toward the track and bleed speed.
  const after = nearest(c.x, c.y, s.seg);
  if (after.d > WIDTH / 2 + BARRIER) {
    const [tx, ty] = TRACK[after.i];
    const nx = (c.x - tx) / after.d;
    const ny = (c.y - ty) / after.d;
    c.x = tx + nx * (WIDTH / 2 + BARRIER);
    c.y = ty + ny * (WIDTH / 2 + BARRIER);
    const vn = c.vx * nx + c.vy * ny;
    if (vn > 0) {
      c.vx -= 1.4 * vn * nx;
      c.vy -= 1.4 * vn * ny;
      ev.push("bump");
    }
  }

  // Checkpoints in order, crossed going forward (from just behind to on/past it); the finish counts last.
  const target = (s.cp * SAMPLES) / CHECKPOINTS;
  const mod = (v: number) => ((v % SAMPLES) + SAMPLES) % SAMPLES;
  const behind = mod(target - prevSeg);
  if (mod(after.i - target) < 12 && behind <= 12) {
    if (s.cp === 0) {
      const lapTime = s.t - s.lapStart;
      s.laps.push(lapTime);
      s.lap++;
      s.lapStart = s.t;
      ev.push("lap");
      if (s.bestLap === null || lapTime < s.bestLap) {
        s.bestLap = lapTime;
        s.ghost = s.rec;
        ev.push("best");
      }
      s.rec = [];
      s.recClock = 0;
      if (s.lap >= LAPS) {
        s.done = true;
        s.score = raceScore(s.t);
        ev.push("done");
        return ev;
      }
    }
    s.cp = (s.cp + 1) % CHECKPOINTS;
  }

  s.recClock += dt;
  while (s.recClock >= GHOST_DT) {
    s.recClock -= GHOST_DT;
    s.rec.push(Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100, Math.round(c.h * 1000) / 1000);
  }
  return ev;
}

/** Ghost pose at time t into the lap, interpolated. */
export function ghostAt(ghost: number[], t: number): { x: number; y: number; h: number } | null {
  const n = ghost.length / 3;
  if (n < 2) return null;
  const f = t / GHOST_DT;
  const i = Math.min(n - 2, Math.floor(f));
  if (f >= n - 1) return null;
  const u = f - i;
  const a = i * 3;
  const b = a + 3;
  let dh = ghost[b + 2] - ghost[a + 2];
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  return { x: ghost[a] + (ghost[b] - ghost[a]) * u, y: ghost[a + 1] + (ghost[b + 1] - ghost[a + 1]) * u, h: ghost[a + 2] + dh * u };
}
