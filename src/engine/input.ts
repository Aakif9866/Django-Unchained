/**
 * One input surface for every game: pointer gestures (tap, swipe, drag with velocity),
 * keyboard, and a two-finger touch that means "pause" (call mode).
 */
export type Dir = "up" | "down" | "left" | "right";
export type Action = Dir | "primary" | "pause";

export type InputEvent =
  | { type: "action"; action: Action }
  | { type: "tap"; x: number; y: number }
  | { type: "swipe"; dir: Dir }
  | { type: "drag"; phase: "start" | "move" | "end"; x: number; y: number; dx: number; dy: number; vx: number; vy: number };

export interface Input {
  on(fn: (e: InputEvent) => void): () => void;
  enabled: boolean;
  destroy(): void;
}

const KEYS: Record<string, Action> = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "primary", Enter: "primary",
  Escape: "pause", KeyP: "pause",
};

const SWIPE_PX = 22; // hysteresis before a drag commits to a direction
const TAP_PX = 10;
const TAP_MS = 320;

export function createInput(el: HTMLElement): Input {
  const subs = new Set<(e: InputEvent) => void>();
  const pointers = new Map<number, { x: number; y: number }>();
  let origin = { x: 0, y: 0, t: 0 };
  let swipeFrom = { x: 0, y: 0 };
  let moved = false;
  let history: { x: number; y: number; t: number }[] = [];
  const input: Input = {
    enabled: false,
    on(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    destroy() {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      subs.clear();
    },
  };
  const emit = (e: InputEvent) => {
    if (input.enabled) subs.forEach((fn) => fn(e));
  };
  const local = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const velocity = () => {
    const a = history[0];
    const b = history[history.length - 1];
    const dt = (b?.t ?? 0) - (a?.t ?? 0);
    return dt > 0 ? { vx: ((b.x - a.x) / dt) * 1000, vy: ((b.y - a.y) / dt) * 1000 } : { vx: 0, vy: 0 };
  };

  function down(e: PointerEvent) {
    el.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      emit({ type: "action", action: "pause" });
      return;
    }
    if (pointers.size > 1) return;
    origin = { ...p, t: e.timeStamp };
    swipeFrom = p;
    moved = false;
    history = [{ ...p, t: e.timeStamp }];
    emit({ type: "drag", phase: "start", ...p, dx: 0, dy: 0, vx: 0, vy: 0 });
  }
  function move(e: PointerEvent) {
    if (!pointers.has(e.pointerId) || pointers.size > 1) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    history.push({ ...p, t: e.timeStamp });
    if (history.length > 6) history.shift();
    if (Math.hypot(p.x - origin.x, p.y - origin.y) > TAP_PX) moved = true;
    const sx = p.x - swipeFrom.x;
    const sy = p.y - swipeFrom.y;
    if (Math.max(Math.abs(sx), Math.abs(sy)) > SWIPE_PX) {
      // Re-arm from here so one continuous gesture can steer several times (snake corners).
      emit({ type: "swipe", dir: Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? "right" : "left") : sy > 0 ? "down" : "up" });
      swipeFrom = p;
    }
    emit({ type: "drag", phase: "move", ...p, dx: p.x - origin.x, dy: p.y - origin.y, ...velocity() });
  }
  function up(e: PointerEvent) {
    if (!pointers.delete(e.pointerId) || pointers.size > 0) return;
    const p = local(e);
    emit({ type: "drag", phase: "end", ...p, dx: p.x - origin.x, dy: p.y - origin.y, ...velocity() });
    if (!moved && e.timeStamp - origin.t < TAP_MS) emit({ type: "tap", ...p });
  }
  function cancel(e: PointerEvent) {
    pointers.delete(e.pointerId);
  }
  function key(e: KeyboardEvent) {
    const action = KEYS[e.code];
    if (!action || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!input.enabled) return;
    e.preventDefault();
    emit({ type: "action", action });
  }

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key);
  return input;
}
