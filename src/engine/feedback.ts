/** Haptics (default on) and tiny synthesized sounds (default off). No audio files to load. */
import { useStore } from "./store";

export type Feel = "tap" | "score" | "success" | "fail";

const VIBES: Record<Feel, number | number[]> = {
  tap: 8,
  score: 14,
  success: [12, 40, 18],
  fail: [30, 50, 70],
};
const TONES: Record<Feel, [number, number, number]> = {
  // start Hz, end Hz, seconds
  tap: [520, 640, 0.05],
  score: [660, 990, 0.09],
  success: [740, 1480, 0.16],
  fail: [300, 90, 0.35],
};

let ctx: AudioContext | null = null;

export function feel(kind: Feel) {
  const { haptics, sound } = useStore.getState().settings;
  if (haptics) navigator.vibrate?.(VIBES[kind]);
  if (!sound) return;
  ctx ??= new AudioContext();
  const [f0, f1, dur] = TONES[kind];
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = kind === "fail" ? "triangle" : "sine";
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01); // quiet on purpose: it ducks under a call
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
