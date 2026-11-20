import { createRng } from "@/engine/rng";
import { think, type Pos } from "./logic";

self.onmessage = (e: MessageEvent<{ pos: Pos; level: number; seed: number }>) => {
  const { pos, level, seed } = e.data;
  postMessage(think(pos, level, createRng(seed), () => performance.now()).move);
};
