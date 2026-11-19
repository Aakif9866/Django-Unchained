"use client";
import { useEffect, useState } from "react";

/** "On hold · 04:12": how long this session has been running, like a call timer. */
export function HoldClock() {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    let start = Date.now();
    try {
      start = Number(sessionStorage.getItem("onhold:since")) || start;
      sessionStorage.setItem("onhold:since", String(start));
    } catch {}
    const tick = () => setSecs(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor((secs ?? 0) / 60)).padStart(2, "0");
  const ss = String((secs ?? 0) % 60).padStart(2, "0");
  return (
    <div className="hud-pill material t-caption" style={{ color: "var(--text-2)" }} aria-label="Session time">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#30d158]" />
      </span>
      <span>On hold</span>
      <span className="t-score" style={{ color: "var(--text)" }}>{secs === null ? "--:--" : `${mm}:${ss}`}</span>
    </div>
  );
}
