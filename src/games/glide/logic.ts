/** Glide rules: a block slides over the tower; dropping it slices off whatever overhangs. */
export type Axis = "x" | "z";
export interface Block {
  x: number; // centre
  z: number;
  w: number; // size along x
  d: number; // size along z
}
export interface GlideState {
  blocks: Block[]; // bottom first; blocks[0] is the base
  axis: Axis;
  pos: number; // moving block's centre on `axis`
  dir: 1 | -1;
  speed: number;
  score: number;
  combo: number;
  over: boolean;
}
export type DropResult =
  | { kind: "perfect"; placed: Block }
  | { kind: "cut"; placed: Block; piece: Block }
  | { kind: "miss"; piece: Block };

export const BASE = 3;
export const HEIGHT = 0.5;
export const RANGE = 4.2; // how far the slider travels from the centre
export const PERFECT = 0.1; // within this distance counts as perfect and snaps
export const GROW = 0.15; // a perfect streak of 4+ grows the block back
const SPEED0 = 3.2;
const SPEED_MAX = 7;

export function newGame(): GlideState {
  return {
    blocks: [{ x: 0, z: 0, w: BASE, d: BASE }],
    axis: "x", pos: -RANGE, dir: 1, speed: SPEED0, score: 0, combo: 0, over: false,
  };
}

export const top = (s: GlideState) => s.blocks[s.blocks.length - 1];

export function moving(s: GlideState): Block {
  const t = top(s);
  return s.axis === "x" ? { ...t, x: s.pos } : { ...t, z: s.pos };
}

export function update(s: GlideState, dt: number) {
  if (s.over) return;
  s.pos += s.dir * s.speed * dt;
  if (Math.abs(s.pos) > RANGE) {
    s.pos = Math.sign(s.pos) * RANGE;
    s.dir = (s.dir * -1) as 1 | -1;
  }
}

export function drop(s: GlideState): DropResult {
  const t = top(s);
  const cur = moving(s);
  const ax = s.axis;
  const size = ax === "x" ? t.w : t.d;
  const delta = cur[ax] - t[ax];
  const overlap = size - Math.abs(delta);

  if (overlap <= 0) {
    s.over = true;
    return { kind: "miss", piece: cur };
  }

  let result: DropResult;
  if (Math.abs(delta) <= PERFECT) {
    s.combo += 1;
    const placed = { ...t };
    if (s.combo >= 4) {
      // Reward a streak: grow back toward the base size along this axis.
      if (ax === "x") placed.w = Math.min(BASE, placed.w + GROW);
      else placed.d = Math.min(BASE, placed.d + GROW);
    }
    result = { kind: "perfect", placed };
  } else {
    s.combo = 0;
    const placed = { ...cur, [ax]: t[ax] + delta / 2, [ax === "x" ? "w" : "d"]: overlap } as Block;
    // The overhang runs from the tower's edge to the slider's edge on the side we overshot.
    const pieceCentre = t[ax] + (Math.sign(delta) * size) / 2 + delta / 2;
    const piece = { ...cur, [ax]: pieceCentre, [ax === "x" ? "w" : "d"]: Math.abs(delta) } as Block;
    result = { kind: "cut", placed, piece };
  }

  s.blocks.push(result.placed);
  s.score += 1;
  s.axis = ax === "x" ? "z" : "x";
  s.dir = 1;
  s.pos = -RANGE;
  s.speed = Math.min(SPEED_MAX, s.speed + 0.08);
  return result;
}
