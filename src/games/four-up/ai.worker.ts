import { createRng } from "@/engine/rng";
import { think, type Color } from "./logic";

self.onmessage = (e: MessageEvent<{ grid: number[]; turn: Color; level: number; seed: number }>) => {
  const { grid, turn, level, seed } = e.data;
  postMessage(think(grid, turn, level, createRng(seed), () => performance.now()).move);
};
