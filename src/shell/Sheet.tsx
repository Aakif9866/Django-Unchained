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
  center = false,
  children,
}: {
  open: boolean;
  onDismiss?: () => void;
  label: string;
  /** A centred card that materialises in place (results), instead of a sheet from the bottom. */
  center?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // Focus the first action so keyboard users can act immediately.
    const t = setTimeout(() => (ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>("button, a"))?.focus(), 50);
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
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.25 }}
            onClick={onDismiss}
          />
          {center ? (
            <div key="center" className="dialog-wrap">
              <motion.div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                className="dialog material-heavy"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, pointerEvents: "none" }}
                transition={{ type: "spring", bounce: 0, visualDuration: 0.32 }}
              >
                {children}
              </motion.div>
            </div>
          ) : (
          <motion.div
            key="sheet"
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="sheet material-heavy"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%", pointerEvents: "none" }}
            transition={SPRING}
            drag={onDismiss ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <div className="grabber" aria-hidden />
            {children}
          </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
