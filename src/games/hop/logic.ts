/**
 * Hop rules. Pure: no DOM, no clock. Rows advance forward; each row is grass (trees block tiles), road (cars),
 * river (ride the logs, water drowns) or rail (a warned, very fast train). Columns −4..4.
 * The camera creeps forward, so dawdling gets you caught. Score = furthest row reached.
 */
import type { Rng } from "@/engine/rng";

export const COLS = 4; // −COLS..COLS
export const SPAN = 9; // objects wrap within ±SPAN
export const HOP_S = 0.12;
export type LaneType = "grass" | "road" | "river" | "rail";
export interface Mover {
  x: number;
  len: number;
}
export interface Lane {
  type: LaneType;
  dir: 1 | -1;
  speed: number;
  movers: Mover[];
  trees: number[];
  train: number; // seconds until the next train (rail)
}
export interface HopState {
  lanes: Record<number, Lane>;
  genRow: number;
  row: number;
  x: number; // float: logs carry you
  hop: number; // seconds left in the current hop animation
  from: { row: number; x: number };
  facing: "up" | "down" | "left" | "right";
  cam: number;
  best: number;
  alive: boolean;
  death: "" | "car" | "water" | "drift" | "caught" | "train";
}

const wrapX = (x: number) => ((((x + SPAN) % (2 * SPAN)) + 2 * SPAN) % (2 * SPAN)) - SPAN;

export function makeLane(row: number, prev: Lane | undefined, rng: Rng): Lane {
  const base: Lane = { type: "grass", dir: 1, speed: 0, movers: [], trees: [], train: 0 };
  if (row < 3) return base;
  const d = Math.min(1, row / 120); // difficulty 0..1
  const r = rng.next();
  const type: LaneType = prev && prev.type !== "grass" && r < 0.3 ? "grass" : r < 0.45 ? "road" : r < 0.7 ? "river" : r < 0.8 ? "rail" : "grass";
  const dir = prev?.dir === 1 ? -1 : 1;
  if (type === "grass") {
    // At most 3 trees, never on the centre column at the start, so there's always a way through.
    const n = rng.int(0, 3);
    const trees = new Set<number>();
    while (trees.size < n) trees.add(rng.int(-COLS, COLS));
    return { ...base, trees: [...trees] };
  }
  if (type === "road") {
    const speed = 2 + rng.next() * 2.5 + d * 3;
    const len = rng.next() < 0.25 ? 2.6 : 1.4; // trucks and cars
    const movers: Mover[] = [];
    for (let x = -SPAN + rng.next() * 3; x < SPAN; x += len + 3 + rng.next() * 4 * (1 - d * 0.5)) movers.push({ x, len });
    return { ...base, type, dir, speed, movers };
  }
  if (type === "river") {
    const speed = 1.2 + rng.next() * 1.6 + d * 1.5;
    const movers: Mover[] = [];
    // Logs long enough and gaps short enough that a log is always within reach.
    for (let x = -SPAN + rng.next() * 2; x < SPAN; ) {
      const len = 2 + rng.int(0, 2);
      movers.push({ x: x + len / 2, len });
      x += len + 1 + rng.next() * 1.8;
    }
    return { ...base, type, dir, speed, movers };
  }
  return { ...base, type: "rail", dir, speed: 38, train: 2 + rng.next() * 4 };
}

export function newGame(rng: Rng): HopState {
  const s: HopState = {
    lanes: {}, genRow: 0, row: 0, x: 0, hop: 0, from: { row: 0, x: 0 }, facing: "up", cam: -2, best: 0, alive: true, death: "",
  };
  fill(s, rng);
  return s;
}

function fill(s: HopState, rng: Rng) {
  while (s.genRow < s.row + 24) {
    s.lanes[s.genRow] = makeLane(s.genRow, s.lanes[s.genRow - 1], rng);
    s.genRow++;
  }
  for (const k of Object.keys(s.lanes)) if (Number(k) < s.row - 12) delete s.lanes[Number(k)];
}

export const blocked = (s: HopState, row: number, col: number) =>
  Math.abs(col) > COLS || row < s.cam - 1 || !!s.lanes[row]?.trees.includes(col);

export function hop(s: HopState, dir: "up" | "down" | "left" | "right", rng: Rng): boolean {
  if (!s.alive || s.hop > 0.04) return false;
  s.facing = dir;
  const col = Math.round(s.x);
  const to = { row: s.row + (dir === "up" ? 1 : dir === "down" ? -1 : 0), col: col + (dir === "right" ? 1 : dir === "left" ? -1 : 0) };
  if (blocked(s, to.row, to.col)) return false;
  s.from = { row: s.row, x: s.x };
  s.row = to.row;
  // Landing on a log keeps your offset on it; elsewhere you snap to the grid.
  s.x = s.lanes[to.row]?.type === "river" && dir !== "left" && dir !== "right" ? s.x : to.col;
  s.hop = HOP_S;
  if (s.row > s.best) s.best = s.row;
  fill(s, rng);
  return true;
}

const camSpeed = (best: number) => 0.35 + Math.min(0.9, best * 0.008);

export function step(s: HopState, dt: number, rng: Rng): void {
  if (!s.alive) return;
  s.hop = Math.max(0, s.hop - dt);
  for (const lane of Object.values(s.lanes)) {
    if (lane.type === "rail") {
      lane.train -= dt;
      if (lane.train < -1.2) {
        lane.train = 3 + rng.next() * 4;
        lane.movers = [];
      }
      if (lane.train <= 0 && lane.movers.length === 0) lane.movers = [{ x: -lane.dir * (SPAN + 6), len: 10 }];
      for (const m of lane.movers) m.x += lane.dir * lane.speed * dt;
      continue;
    }
    for (const m of lane.movers) m.x = wrapX(m.x + lane.dir * lane.speed * dt);
  }
  s.cam = Math.max(s.cam + camSpeed(s.best) * dt, s.row - 3);

  const lane = s.lanes[s.row];
  if (s.hop > 0 || !lane) return; // mid-air
  const on = (m: Mover, pad: number) => Math.abs(wrapX(s.x - m.x)) < m.len / 2 + pad;
  if (lane.type === "road" && lane.movers.some((m) => on(m, 0.3))) return die(s, "car");
  if (lane.type === "rail" && lane.movers.some((m) => on(m, 0.3))) return die(s, "train");
  if (lane.type === "river") {
    const log = lane.movers.find((m) => on(m, 0.15));
    if (!log) return die(s, "water");
    s.x += lane.dir * lane.speed * dt;
    if (Math.abs(s.x) > COLS + 0.6) return die(s, "drift");
  }
  if (s.row < s.cam - 1.5) die(s, "caught");
}

function die(s: HopState, why: HopState["death"]) {
  s.alive = false;
  s.death = why;
}

/** Seconds until a train arrives on this rail, for the warning light; null when none is coming soon. */
export const trainWarning = (l: Lane) => (l.type === "rail" && l.train > 0 && l.train < 1.4 ? l.train : null);
