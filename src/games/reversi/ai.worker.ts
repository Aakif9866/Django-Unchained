import { createRng } from "@/engine/rng";
import { think, type Color } from "./logic";

self.onmessage = (e: MessageEvent<{ board: number[]; turn: Color; level: number; seed: number }>) => {
  const { board, turn, level, seed } = e.data;
  postMessage(think(board, turn, level, createRng(seed), () => performance.now()).move);
};
