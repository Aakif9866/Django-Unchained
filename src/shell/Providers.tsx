"use client";
import { MotionConfig } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";
import { useStore } from "@/engine/store";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useStore.persist.rehydrate();
    // The colour grade lives on <html>, so every token (and the games' HUD) follows it.
    const apply = () => (document.documentElement.dataset.palette = useStore.getState().palette);
    apply();
    const unsub = useStore.subscribe(apply);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return unsub;
  }, []);
  // "user" swaps transform/spring motion for opacity when Reduce Motion is on.
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** True once persisted data (bests, settings) has loaded; render saved numbers only after. */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useStore.persist?.onFinishHydration(cb) ?? (() => {}),
    () => useStore.persist?.hasHydrated() ?? false,
    () => false, // static HTML never has saved data
  );
}
