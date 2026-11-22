"use client";
import { useState } from "react";
import { PALETTES, useStore, type Palette, type Settings } from "@/engine/store";
import { Sheet } from "./Sheet";

const ROWS: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "haptics", label: "Haptics", hint: "A small buzz on scores and crashes" },
  { key: "sound", label: "Sound", hint: "Off by default so it never talks over your call" },
  { key: "battery", label: "Battery saver", hint: "30 fps and lighter graphics" },
];

// Each swatch previews its grade's shine (the same stops as globals.css).
const GRADES: Record<Palette, { name: string; swatch: string }> = {
  aurora: { name: "Aurora", swatch: "linear-gradient(135deg, #fb923c, #f43f5e, #a855f7, #38bdf8)" },
  apple: { name: "Apple Blue", swatch: "linear-gradient(135deg, #30d158, #64d2ff, #0a84ff)" },
  emerald: { name: "Emerald", swatch: "linear-gradient(135deg, #a3e635, #34d399, #22d3ee)" },
  solar: { name: "Solar", swatch: "linear-gradient(135deg, #fde047, #fbbf24, #f97316)" },
  ocean: { name: "Ocean", swatch: "linear-gradient(135deg, #22d3ee, #3b82f6, #818cf8)" },
  titanium: { name: "Titanium", swatch: "linear-gradient(135deg, #ffffff, #a1a1aa, #3f3f46)" },
};

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const resetAll = useStore((s) => s.resetAll);
  const palette = useStore((s) => s.palette);
  const setPalette = useStore((s) => s.setPalette);
  const [confirm, setConfirm] = useState(false);

  return (
    <Sheet open={open} onDismiss={onClose} label="Settings">
      <h2 className="t-title mb-4">Settings</h2>
      <div className="surface divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius)]">
        {ROWS.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-center gap-4 px-4 py-3.5">
            <span className="flex-1">
              <span className="t-headline block">{r.label}</span>
              <span className="t-caption">{r.hint}</span>
            </span>
            <button
              role="switch"
              aria-checked={settings[r.key]}
              aria-label={r.label}
              className="toggle"
              onClick={() => setSetting(r.key, !settings[r.key])}
            />
          </label>
        ))}
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="t-eyebrow text-[0.72rem]">Colour grade</span>
          <span className="t-caption">{GRADES[palette].name}</span>
        </div>
        <div className="surface flex justify-between gap-2 rounded-[var(--radius)] p-3" role="radiogroup" aria-label="Colour grade">
          {PALETTES.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={palette === p}
              aria-label={GRADES[p].name}
              className="swatch"
              style={{ backgroundImage: GRADES[p].swatch }}
              onClick={() => setPalette(p)}
            />
          ))}
        </div>
      </div>
      <button
        className="btn btn-ghost mt-4 w-full"
        style={{ color: confirm ? "#ff6b6b" : "var(--text-2)" }}
        onClick={() => {
          if (!confirm) return setConfirm(true);
          resetAll();
          setConfirm(false);
        }}
        onBlur={() => setConfirm(false)}
      >
        {confirm ? "Tap again to erase scores and settings" : "Reset scores and settings"}
      </button>
    </Sheet>
  );
}
