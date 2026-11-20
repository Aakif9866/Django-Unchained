import type { Action } from "@/engine/input";
import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { newGame, nextLevel, tap, type LightsState } from "./logic";

const FLIP = 0.2; // s

const lightsOut: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: LightsState = newGame(rng);
    const flips = new Map<number, number>(); // cell → seconds since it flipped
    let pressed = -1;
    let press: "next" | null = null;
    let cursor = -1;
    let shown = 0;
    let overIn = -1;
    let hot = 1;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const top = ins.top + 10;
      const avail = stage.height - ins.bottom - 10 - top - 52 - 30;
      const size = Math.max(200, Math.min(stage.width - 32, avail, 560));
      const x = Math.round((stage.width - size) / 2);
      const y = Math.round(top + 52 + Math.max(0, (avail - size) / 2));
      return { x, y, size, cell: size / s.n, infoY: y - 52 };
    }
    const cellAt = (px: number, py: number) => {
      const c = Math.floor((px - L.x) / L.cell), r = Math.floor((py - L.y) / L.cell);
      return c >= 0 && c < s.n && r >= 0 && r < s.n ? r * s.n + c : -1;
    };

    function doTap(cell: number) {
      const before = s.score;
      if (!tap(s, cell)) return;
      if (!reducedMotion) {
        const r = Math.floor(cell / s.n), c = cell % s.n;
        for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
          if (r + dr >= 0 && r + dr < s.n && c + dc >= 0 && c + dc < s.n) flips.set((r + dr) * s.n + c + dc, 0);
      }
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (s.solved) {
        emit({ type: "feel", kind: "success" });
        shown = 0;
      } else if (!s.alive) {
        emit({ type: "feel", kind: "fail" });
        shown = 0;
        overIn = 1.7;
      } else emit({ type: "feel", kind: "tap" });
    }
    function next() {
      nextLevel(s, rng);
      flips.clear();
      emit({ type: "feel", kind: "tap" });
    }

    function onAction(a: Action) {
      if (s.solved) return void (a === "primary" && next());
      if (!s.alive) return;
      if (cursor < 0) return void (cursor = Math.floor((s.n * s.n) / 2)); // the first key only reveals the cursor
      const r = Math.floor(cursor / s.n), c = cursor % s.n;
      if (a === "left") cursor = r * s.n + Math.max(0, c - 1);
      else if (a === "right") cursor = r * s.n + Math.min(s.n - 1, c + 1);
      else if (a === "up") cursor = Math.max(0, r - 1) * s.n + c;
      else if (a === "down") cursor = Math.min(s.n - 1, r + 1) * s.n + c;
      else if (a === "primary") doTap(cursor);
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "action") return onAction(e.action);
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        cursor = -1;
        press = s.solved ? "next" : null;
        pressed = s.alive && !s.solved ? cellAt(e.x, e.y) : -1; // pressed look at once; the flip lands on release
      } else if (e.phase === "move") {
        if (pressed >= 0 && cellAt(e.x, e.y) !== pressed) pressed = -1; // slide off to cancel
      } else {
        if (press === "next" && shown > 0.5) next();
        else if (pressed >= 0) doTap(pressed);
        pressed = -1;
        press = null;
      }
    });

    return {
      update(dt) {
        if (flips.size) {
          for (const [k, t] of flips) {
            if (t + dt >= FLIP) flips.delete(k);
            else flips.set(k, t + dt);
          }
          hot = 1;
        }
        if (s.solved || !s.alive) {
          if (shown < 1) {
            shown = Math.min(1, shown + dt / 0.35);
            hot = 1;
          }
          if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
        }
        hot = Math.max(0, hot - dt);
      },

      render() {
        if (hot <= 0 && stage.width === lastW && stage.height === lastH) return;
        lastW = stage.width;
        lastH = stage.height;
        L = layout();
        const W = stage.width, H = stage.height, c = L.cell;
        const lit = s.lights.filter(Boolean).length;
        ctx.clearRect(0, 0, W, H);
        // The room glows warmer the more lights are on.
        const glow = ctx.createRadialGradient(W / 2, L.y + L.size / 2, 0, W / 2, L.y + L.size / 2, Math.max(W, H) * 0.75);
        glow.addColorStop(0, `rgba(248,181,0,${0.08 + 0.22 * (lit / (s.n * s.n))})`);
        glow.addColorStop(0.5, "rgba(255,110,127,0.07)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        pill(ctx, L.x, L.infoY, L.size, 40, null);
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(`Level ${s.level} · par ${s.par}`, L.x + 16, L.infoY + 21);
        ctx.textAlign = "right";
        ctx.fillStyle = s.movesLeft <= 2 && s.alive && !s.solved ? "#ff8a8a" : "rgba(255,255,255,0.92)";
        ctx.fillText(`${s.movesLeft} moves left`, L.x + L.size - 16, L.infoY + 21);

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "#1c1622";
        ctx.beginPath();
        ctx.roundRect(L.x - 8, L.y - 8, L.size + 16, L.size + 16, 22);
        ctx.fill();
        ctx.restore();

        const pad = Math.max(3, c * 0.07);
        for (let i = 0; i < s.n * s.n; i++) {
          const x = L.x + (i % s.n) * c + pad, y = L.y + Math.floor(i / s.n) * c + pad, w = c - pad * 2;
          const t = flips.get(i);
          const p = t === undefined ? 1 : t / FLIP;
          // Mid-flip the cell squashes and its glow cross-fades from the old state to the new one.
          const on = s.lights[i] ? Math.min(1, p * 1.6) : 1 - Math.min(1, p * 1.6);
          const k = (t === undefined ? 1 : 0.86 + 0.14 * p) * (i === pressed ? 0.92 : 1);
          const cx = x + w / 2, cy = y + w / 2, ww = w * k;
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.beginPath();
          ctx.roundRect(cx - ww / 2, cy - ww / 2, ww, ww, ww * 0.22);
          ctx.fill();
          if (on > 0) {
            const g = ctx.createLinearGradient(cx - ww / 2, cy - ww / 2, cx + ww / 2, cy + ww / 2);
            g.addColorStop(0, "#fff3c4");
            g.addColorStop(0.5, "#f8b500");
            g.addColorStop(1, "#ff6e7f");
            ctx.save();
            ctx.globalAlpha = on;
            ctx.shadowColor = "#f8b500";
            ctx.shadowBlur = ww * 0.45;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.roundRect(cx - ww / 2, cy - ww / 2, ww, ww, ww * 0.22);
            ctx.fill();
            ctx.restore();
          }
          if (i === cursor) {
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(cx - w / 2 - 2, cy - w / 2 - 2, w + 4, w + 4, w * 0.24);
            ctx.stroke();
          }
        }

        if (s.solved)
          banner(ctx, { cx: W / 2, cy: L.y + L.size / 2, w: Math.min(L.size - 16, 300), title: "Lights out", detail: `+${50 * s.level + 20 * s.movesLeft}`, hint: `Tap for level ${s.level + 1}`, t: shown, colors: ["#fceabb", "#f8b500"], reducedMotion });
        else if (!s.alive)
          banner(ctx, { cx: W / 2, cy: L.y + L.size / 2, w: Math.min(L.size - 16, 300), title: "Out of moves", detail: `${lit} still lit · level ${s.level}`, hint: "", t: shown, colors: ["#ffb199", "#ff6e7f"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as LightsState;
        flips.clear();
        pressed = -1;
        shown = 0;
        overIn = s.alive ? -1 : 0.6;
        hot = 1;
      },
      destroy: off,
    };
  },
};

export default lightsOut;
