/** Seeded PRNG (mulberry32). Its state is one uint32, so it snapshots with the game. */
export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  state(): number;
  setState(s: number): void;
}

export function createRng(seed: number = (Math.random() * 2 ** 32) >>> 0): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    state: () => s,
    setState: (v) => {
      s = v >>> 0;
    },
  };
}
