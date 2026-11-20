/**
 * Orbit rules. Pure: no DOM, no clock. A 120 × 160 wraparound world.
 * One-thumb twin-stick: the drag vector sets aim + thrust, and the ship fires automatically.
 */
import type { Rng } from "@/engine/rng";

export const W = 120;
export const H = 160;
export const SHIP_R = 3;
export const ROCK_R = [0, 3.8, 7, 12];
export const ROCK_POINTS = [0, 100, 50, 20];
export const FIRE_EVERY = 0.22;
export const BULLET_SPEED = 115;
export const BULLET_LIFE = 0.85;
export const TURN_RATE = 7; // rad/s toward the aim
export const THRUST = 75;
export const MAX_SPEED = 70;
export const DRAG = 0.55; // velocity kept per second
export const INVULN = 2.5;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Rock extends Body {
  size: 1 | 2 | 3;
  seed: number; // outline shape
  spin: number;
  a: number;
}
export interface Bullet extends Body {
  life: number;
}
export interface Control {
  aim: number | null; // target heading (rad) from the drag, or null
  turn: number; // -1..1 from keys when no aim
  thrust: number; // 0..1
}
export interface OrbitState {
  ship: Body & { a: number; inv: number };
  rocks: Rock[];
  bullets: Bullet[];
  ctl: Control;
  fireCd: number;
  score: number;
  lives: number;
  wave: number;
  alive: boolean;
}
export type Event = "fire" | "hit" | "split" | "crash" | "wave" | "dead";

export const wrap = (v: number, m: number) => ((v % m) + m) % m;
/** Shortest signed delta on a torus. */
export const wd = (d: number, m: number) => d - m * Math.round(d / m);
export const dist2 = (a: Body, b: Body) => wd(a.x - b.x, W) ** 2 + wd(a.y - b.y, H) ** 2;
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function spawnWave(s: OrbitState, rng: Rng) {
  const n = Math.min(10, 2 + s.wave);
  for (let i = 0; i < n; i++) {
    // Spawn on a ring well away from the ship so a new wave never kills instantly.
    const a = rng.next() * Math.PI * 2;
    const r = 45 + rng.next() * 20;
    const sp = 8 + rng.next() * (6 + s.wave * 1.5);
    const d = rng.next() * Math.PI * 2;
    s.rocks.push({
      x: wrap(s.ship.x + Math.cos(a) * r, W), y: wrap(s.ship.y + Math.sin(a) * r, H),
      vx: Math.cos(d) * sp, vy: Math.sin(d) * sp, size: 3, seed: rng.int(1, 1e6), spin: (rng.next() - 0.5) * 1.2, a: 0,
    });
  }
}

export function newGame(rng: Rng): OrbitState {
  const s: OrbitState = {
    ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: INVULN }, rocks: [], bullets: [],
    ctl: { aim: null, turn: 0, thrust: 0 }, fireCd: 0.5, score: 0, lives: 3, wave: 1, alive: true,
  };
  spawnWave(s, rng);
  return s;
}

export function step(s: OrbitState, dt: number, rng: Rng): Event[] {
  const ev: Event[] = [];
  if (!s.alive) return ev;
  const sh = s.ship;
  const c = s.ctl;
  if (c.aim !== null) {
    const d = angDiff(sh.a, c.aim);
    sh.a += Math.sign(d) * Math.min(Math.abs(d), TURN_RATE * dt);
  } else sh.a += c.turn * TURN_RATE * 0.6 * dt;
  sh.vx += Math.cos(sh.a) * THRUST * c.thrust * dt;
  sh.vy += Math.sin(sh.a) * THRUST * c.thrust * dt;
  const keep = DRAG ** dt;
  sh.vx *= keep;
  sh.vy *= keep;
  const sp = Math.hypot(sh.vx, sh.vy);
  if (sp > MAX_SPEED) {
    sh.vx *= MAX_SPEED / sp;
    sh.vy *= MAX_SPEED / sp;
  }
  sh.x = wrap(sh.x + sh.vx * dt, W);
  sh.y = wrap(sh.y + sh.vy * dt, H);
  sh.inv = Math.max(0, sh.inv - dt);

  s.fireCd -= dt;
  if (s.fireCd <= 0) {
    s.fireCd += FIRE_EVERY;
    s.bullets.push({
      x: sh.x + Math.cos(sh.a) * SHIP_R, y: sh.y + Math.sin(sh.a) * SHIP_R,
      vx: sh.vx + Math.cos(sh.a) * BULLET_SPEED, vy: sh.vy + Math.sin(sh.a) * BULLET_SPEED, life: BULLET_LIFE,
    });
    ev.push("fire");
  }
  for (const b of s.bullets) {
    b.x = wrap(b.x + b.vx * dt, W);
    b.y = wrap(b.y + b.vy * dt, H);
    b.life -= dt;
  }
  for (const r of s.rocks) {
    r.x = wrap(r.x + r.vx * dt, W);
    r.y = wrap(r.y + r.vy * dt, H);
    r.a += r.spin * dt;
  }

  // Bullets vs rocks.
  const born: Rock[] = [];
  for (const b of s.bullets) {
    if (b.life <= 0) continue;
    const r = s.rocks.find((r) => r.size > 0 && dist2(b, r) < ROCK_R[r.size] ** 2);
    if (!r) continue;
    b.life = 0;
    s.score += ROCK_POINTS[r.size];
    ev.push(r.size > 1 ? "split" : "hit");
    if (r.size > 1) {
      const sp2 = Math.hypot(r.vx, r.vy) * 1.25 + 4;
      const base = Math.atan2(b.vy, b.vx);
      for (const off of [Math.PI / 2, -Math.PI / 2]) {
        const a = base + off + (rng.next() - 0.5) * 0.6;
        born.push({
          x: r.x, y: r.y, vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2, size: (r.size - 1) as 1 | 2,
          seed: rng.int(1, 1e6), spin: (rng.next() - 0.5) * 2, a: 0,
        });
      }
    }
    r.size = 0 as 1; // mark dead
  }
  s.rocks = s.rocks.filter((r) => r.size > 0).concat(born);
  s.bullets = s.bullets.filter((b) => b.life > 0);

  // Ship vs rocks.
  if (sh.inv <= 0 && s.rocks.some((r) => dist2(sh, r) < (ROCK_R[r.size] + SHIP_R * 0.8) ** 2)) {
    s.lives--;
    if (s.lives <= 0) {
      s.alive = false;
      ev.push("dead");
      return ev;
    }
    ev.push("crash");
    Object.assign(sh, { x: W / 2, y: H / 2, vx: 0, vy: 0, inv: INVULN });
  }

  if (s.rocks.length === 0) {
    s.wave++;
    s.score += 250;
    sh.inv = Math.max(sh.inv, 1.5);
    spawnWave(s, rng);
    ev.push("wave");
  }
  return ev;
}
