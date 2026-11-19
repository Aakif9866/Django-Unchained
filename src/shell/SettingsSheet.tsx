"use client";
import { useState } from "react";
import { useStore, type Settings } from "@/engine/store";
import { Sheet } from "./Sheet";

const ROWS: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "haptics", label: "Haptics", hint: "A small buzz on scores and crashes" },
  { key: "sound", label: "Sound", hint: "Off by default so it never talks over your call" },
  { key: "battery", label: "Battery saver", hint: "30 fps and lighter graphics" },
];

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const resetAll = useStore((s) => s.resetAll);
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
