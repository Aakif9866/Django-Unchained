"use client";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useEffect, useRef } from "react";

const SPRING = { type: "spring", bounce: 0.15, visualDuration: 0.35 } as const;

/**
 * Frosted bottom sheet. Springs up from the bottom and leaves the same way.
 * Drag it down or press Escape to dismiss.
 */
export function Sheet({
  open,
  onDismiss,
  label,
  children,
}: {
  open: boolean;
  onDismiss?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // Focus the first action so keyboard users can act immediately.
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("button, a")?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onDismiss) {
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onDismiss]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // Velocity decides intent, not just distance: a quick flick dismisses.
    if (onDismiss && (info.offset.y > 110 || info.velocity.y > 600)) onDismiss();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onDismiss}
          />
          <motion.div
            key="sheet"
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="sheet material-heavy"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={SPRING}
            drag={onDismiss ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <div className="grabber" aria-hidden />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
