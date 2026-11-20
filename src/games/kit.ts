/** Shared by the turn-based games: the engine Worker bridge, and a few drawn pieces (strip pill, thinking dots, result banner). */

const MIN_THINK = 0.45; // s: even instant replies wait a beat, so they read as a reply

/**
 * Runs a game's engine in a Web Worker so the UI never stalls (falls back to the main thread if the worker fails).
 * Call step() on every update while it's the engine's turn: it asks once, then plays the reply after MIN_THINK.
 * Time only passes in step(), so pausing the game pauses the engine's turn too.
 */
export function createThinker<Q>(spawn: () => Worker, fallback: (q: Q) => number) {
  let worker: Worker | null = null;
  let answer: number | null = null;
  let asked = false;
  let waited = 0;
  const reset = () => {
    worker?.terminate();
    worker = null;
    answer = null;
    asked = false;
  };
  const ask = (q: Q) => {
    try {
      worker ??= spawn();
      worker.onmessage = (e: MessageEvent<number>) => (answer = e.data);
      worker.onerror = (e) => {
        console.error("Engine worker failed; thinking on the main thread instead.", e.message);
        reset();
        asked = true;
        answer = fallback(q);
      };
      worker.postMessage(q);
    } catch (e) {
      console.error("Engine worker unavailable; thinking on the main thread instead.", e);
      answer = fallback(q);
    }
  };
  return {
    step(dt: number, question: () => Q, play: (move: number) => void) {
      if (!asked) {
        asked = true;
        waited = 0;
        answer = null;
        ask(question());
      }
      waited += dt;
      if (answer !== null && waited >= MIN_THINK) {
        const m = answer;
        answer = null;
        asked = false;
        play(m);
      }
    },
    /** Forget any pending question (restore, restart) and stop the worker. */
    reset,
  };
}
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Frosted strip pill. `glow` marks whose turn it is. */
export function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, glow: string | null) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = glow ? "rgba(255,255,255,0.11)" : "rgba(255,255,255,0.05)";
  ctx.strokeStyle = glow ?? "rgba(255,255,255,0.09)";
  ctx.lineWidth = glow ? 1.5 : 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

/** Three pulsing dots: the engine is thinking. */
export function dots(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, still: boolean) {
  for (let i = 0; i < 3; i++) {
    const a = still ? 0.7 : 0.35 + 0.65 * Math.max(0, Math.sin(time * 6 - i * 0.7));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(x + i * 8, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Result card over the board. `t` runs 0 → 1 as it arrives (scale + fade; fade only with reduced motion). */
export function banner(
  ctx: CanvasRenderingContext2D,
  o: { cx: number; cy: number; w: number; title: string; detail: string; hint: string; t: number; colors: [string, string]; reducedMotion: boolean },
) {
  const e = ease(o.t);
  const h = o.hint ? 128 : 100;
  ctx.save();
  ctx.globalAlpha = e;
  ctx.translate(o.cx, o.cy);
  if (!o.reducedMotion) ctx.scale(0.92 + 0.08 * e, 0.92 + 0.08 * e);
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "rgba(16,16,30,0.9)";
  ctx.beginPath();
  ctx.roundRect(-o.w / 2, -h / 2, o.w, h, 26);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.stroke();
  const g = ctx.createLinearGradient(-o.w / 3, 0, o.w / 3, 0);
  g.addColorStop(0, o.colors[0]);
  g.addColorStop(1, o.colors[1]);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = g;
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillText(o.title, 0, -h / 2 + 34);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillText(o.detail, 0, -h / 2 + 66);
  if (o.hint) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "500 13px system-ui, sans-serif";
    ctx.fillText(o.hint, 0, -h / 2 + 96);
  }
  ctx.restore();
}
