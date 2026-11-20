"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Settings {
  haptics: boolean;
  sound: boolean; // silent by default: you're on a call
  battery: boolean; // 30 fps + lower resolution
}
export interface Run {
  score: number;
  at: number;
}

interface State {
  settings: Settings;
  bests: Record<string, number>;
  history: Record<string, Run[]>;
  recent: string[];
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
  /** Records a finished run; returns true when it is a new personal best. */
  recordRun(id: string, score: number): boolean;
  touch(id: string): void;
  resetAll(): void;
}

const initial = {
  settings: { haptics: true, sound: false, battery: false },
  bests: {},
  history: {},
  recent: [],
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
      recordRun(id, score) {
        const prev = get().bests[id] ?? 0;
        const isBest = score > prev;
        set((s) => ({
          bests: isBest ? { ...s.bests, [id]: score } : s.bests,
          history: { ...s.history, [id]: [{ score, at: Date.now() }, ...(s.history[id] ?? [])].slice(0, 20) },
        }));
        return isBest;
      },
      touch: (id) => set((s) => ({ recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 8) })),
      resetAll: () => set(initial),
    }),
    {
      name: "onhold",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // rehydrated on mount, so static HTML and first client render match
    },
  ),
);

/** Battery saver: the user's toggle, or automatic when the device is low (≤ 20%) and not charging. */
let lowBattery = false;
type BatteryLike = EventTarget & { level: number; charging: boolean };
if (typeof navigator !== "undefined" && "getBattery" in navigator) {
  (navigator as Navigator & { getBattery(): Promise<BatteryLike> })
    .getBattery()
    .then((b) => {
      const check = () => (lowBattery = !b.charging && b.level <= 0.2);
      check();
      b.addEventListener("levelchange", check);
      b.addEventListener("chargingchange", check);
    })
    .catch(() => {});
}
export const batterySaver = () => useStore.getState().settings.battery || lowBattery;
