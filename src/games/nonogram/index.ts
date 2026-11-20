import type { Action } from "@/engine/input";
import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { CROSS, EMPTY, FILL, MAX_MISTAKES, lineDone, mark, newGame, nextPuzzle, type NonoState } from "./logic";

const nonogram: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: NonoState = newGame(rng);
    let mode: typeof FILL | typeof CROSS = FILL;
    // A drag paints along the row or column it starts moving in.
    let paint: { r0: number; c0: number; axis: "r" | "c" | null } | null = null;
    let press: "mode" | "next" | null = null;
    let cursor = -1;
    let flash = new Map<number, number>(); // cell → seconds left of a mistake flash
    let shown = 0;
    let overIn = -1;
    let hot = 1;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const top = ins.top + 10;
      const maxRow = Math.max(1, ...s.rows.map((c) => c.length));
      const maxCol = Math.max(1, ...s.cols.map((c) => c.length));
      const availH = stage.height - ins.bottom - 12 - top - 52 - 70;
      // Clue rails use ~0.55 of a cell per number.
      const cell = Math.max(18, Math.floor(Math.min((stage.width - 20) / (s.n + maxRow * 0.55), availH / (s.n + maxCol * 0.55), 60)));
      const railW = Math.ceil(maxRow * cell * 0.55) + 6, railH = Math.ceil(maxCol * cell * 0.55) + 6;
      const total = railW + s.n * cell;
      const x = Math.round((stage.width - total) / 2) + railW;
      const y = Math.round(top + 52 + railH + Math.max(0, (availH - railH - s.n * cell) / 2));
      const g = s.n * cell;
      return { x, y, cell, g, railW, railH, infoY: y - railH - 52, infoX: x - railW, infoW: total, mode: { x: stage.width / 2 - 80, y: y + g + 16, w: 160, h: 46 } };
    }
    const cellAt = (px: number, py: number) => {
      const c = Math.floor((px - L.x) / L.cell), r = Math.floor((py - L.y) / L.cell);
      return c >= 0 && c < s.n && r >= 0 && r < s.n ? r * s.n + c : -1;
    };
    const inRect = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

    function doMark(cell: number, as: typeof FILL | typeof CROSS) {
      if (cell < 0 || s.marks[cell] !== EMPTY) return;
      const before = s.score;
      const r = mark(s, cell, as);
      if (!r) return;
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (r === "mistake") {
        flash.set(cell, 0.6);
        emit({ type: "feel", kind: "fail" });
        paint = null; // a mistake stops the stroke
        if (!s.alive) {
          shown = 0;
          overIn = 1.8;
        }
      } else if (r === "solved") {
        emit({ type: "feel", kind: "success" });
        shown = 0;
      } else emit({ type: "feel", kind: "tap" });
    }
    function next() {
      nextPuzzle(s, rng);
      flash = new Map();
      L = layout();
      emit({ type: "feel", kind: "tap" });
    }

    function onAction(a: Action) {
      if (s.solved) return void (a === "primary" && next());
      if (!s.alive) return;
      if (cursor < 0) return void (cursor = 0);
      const r = Math.floor(cursor / s.n), c = cursor % s.n;
      if (a === "left") cursor = r * s.n + Math.max(0, c - 1);
      else if (a === "right") cursor = r * s.n + Math.min(s.n - 1, c + 1);
      else if (a === "up") cursor = Math.max(0, r - 1) * s.n + c;
      else if (a === "down") cursor = Math.min(s.n - 1, r + 1) * s.n + c;
      else if (a === "primary") doMark(cursor, FILL);
      else if (a === "secondary") doMark(cursor, CROSS);
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "action") return onAction(e.action);
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        cursor = -1;
        press = s.solved ? "next" : inRect(L.mode, e.x, e.y) && s.alive ? "mode" : null;
        const cell = s.alive && !s.solved ? cellAt(e.x, e.y) : -1;
        paint = cell >= 0 ? { r0: Math.floor(cell / s.n), c0: cell % s.n, axis: null } : null;
        if (cell >= 0) doMark(cell, mode); // paints on press
      } else if (e.phase === "move") {
        if (!paint) return;
        if (!paint.axis && Math.hypot(e.dx, e.dy) > L.cell * 0.5) paint.axis = Math.abs(e.dx) > Math.abs(e.dy) ? "r" : "c";
        if (!paint.axis) return;
        const c = Math.floor((e.x - L.x) / L.cell), r = Math.floor((e.y - L.y) / L.cell);
        const rr = paint.axis === "r" ? paint.r0 : Math.max(0, Math.min(s.n - 1, r));
        const cc = paint.axis === "c" ? paint.c0 : Math.max(0, Math.min(s.n - 1, c));
        // Fill every cell between the start and the finger, so a fast drag doesn't skip any.
        const from = paint.axis === "r" ? paint.c0 : paint.r0, to = paint.axis === "r" ? cc : rr;
        for (let k = Math.min(from, to); k <= Math.max(from, to) && paint; k++)
          doMark(paint.axis === "r" ? rr * s.n + k : k * s.n + cc, mode);
      } else {
        if (press === "mode" && inRect(L.mode, e.x, e.y)) {
          mode = mode === FILL ? CROSS : FILL;
          emit({ type: "feel", kind: "tap" });
        } else if (press === "next" && shown > 0.5) next();
        press = null;
        paint = null;
      }
    });

    return {
      update(dt) {
        if (flash.size) {
          for (const [k, t] of flash) {
            if (t - dt <= 0) flash.delete(k);
            else flash.set(k, t - dt);
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
        const W = stage.width, H = stage.height, c = L.cell, n = s.n;
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, L.y + L.g * 0.4, 0, W / 2, L.y + L.g * 0.4, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(118,75,162,0.3)");
        glow.addColorStop(0.5, "rgba(102,126,234,0.1)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        pill(ctx, L.infoX, L.infoY, L.infoW, 40, null);
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(`Picture ${s.level} · ${n}×${n}`, L.infoX + 16, L.infoY + 21);
        for (let k = 0; k < MAX_MISTAKES; k++) {
          const hx = L.infoX + L.infoW - 20 - (MAX_MISTAKES - 1 - k) * 22, hy = L.infoY + 20;
          ctx.fillStyle = k < MAX_MISTAKES - s.mistakes ? "#ff5c7a" : "rgba(255,255,255,0.15)";
          ctx.beginPath();
          ctx.moveTo(hx, hy + 6);
          ctx.bezierCurveTo(hx - 10, hy - 2, hx - 5, hy - 9, hx, hy - 4);
          ctx.bezierCurveTo(hx + 5, hy - 9, hx + 10, hy - 2, hx, hy + 6);
          ctx.fill();
        }

        // Clue rails: the row / column under your finger or cursor lights up, finished ones fade.
        const focus = cursor >= 0 ? cursor : paint ? paint.r0 * n + paint.c0 : -1;
        const fr = focus >= 0 ? Math.floor(focus / n) : -1, fc = focus >= 0 ? focus % n : -1;
        const fs = Math.round(c * 0.42);
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        for (let i = 0; i < n; i++) {
          if (i === fc) {
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.beginPath();
            ctx.roundRect(L.x + i * c + 2, L.y - L.railH, c - 4, L.railH - 2, 8);
            ctx.fill();
          }
          if (i === fr) {
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.beginPath();
            ctx.roundRect(L.x - L.railW, L.y + i * c + 2, L.railW - 2, c - 4, 8);
            ctx.fill();
          }
          ctx.fillStyle = lineDone(s, false, i) ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.9)";
          const col = s.cols[i].length ? s.cols[i] : [0];
          col.forEach((v, k) => ctx.fillText(String(v), L.x + i * c + c / 2, L.y - 6 - (col.length - 1 - k) * c * 0.55 - c * 0.25));
          ctx.fillStyle = lineDone(s, true, i) ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.9)";
          const row = s.rows[i].length ? s.rows[i] : [0];
          row.forEach((v, k) => ctx.fillText(String(v), L.x - 8 - (row.length - 1 - k) * c * 0.55 - c * 0.2, L.y + i * c + c / 2 + 1));
        }

        ctx.fillStyle = "#171527";
        ctx.beginPath();
        ctx.roundRect(L.x - 3, L.y - 3, L.g + 6, L.g + 6, 10);
        ctx.fill();
        for (let i = 0; i < n * n; i++) {
          const x = L.x + (i % n) * c, y = L.y + Math.floor(i / n) * c;
          const m = s.marks[i];
          const f = flash.get(i);
          if (f) {
            ctx.fillStyle = `rgba(255,70,100,${f})`;
            ctx.fillRect(x, y, c, c);
          }
          if (m === FILL) {
            const g = ctx.createLinearGradient(x, y, x + c, y + c);
            g.addColorStop(0, "#8b9cff");
            g.addColorStop(1, "#8a4fd8");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.roundRect(x + 2, y + 2, c - 4, c - 4, c * 0.18);
            ctx.fill();
          } else if (m === CROSS) {
            ctx.strokeStyle = "rgba(255,255,255,0.32)";
            ctx.lineWidth = Math.max(1.5, c * 0.07);
            ctx.beginPath();
            ctx.moveTo(x + c * 0.32, y + c * 0.32);
            ctx.lineTo(x + c * 0.68, y + c * 0.68);
            ctx.moveTo(x + c * 0.68, y + c * 0.32);
            ctx.lineTo(x + c * 0.32, y + c * 0.68);
            ctx.stroke();
          } else if (Math.floor(i / n) === fr || i % n === fc) {
            ctx.fillStyle = "rgba(255,255,255,0.04)";
            ctx.fillRect(x, y, c, c);
          }
        }
        ctx.lineWidth = 1;
        for (let k = 1; k < n; k++) {
          ctx.strokeStyle = k % 5 === 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"; // every fifth line is a guide
          ctx.beginPath();
          ctx.moveTo(L.x + k * c + 0.5, L.y);
          ctx.lineTo(L.x + k * c + 0.5, L.y + L.g);
          ctx.moveTo(L.x, L.y + k * c + 0.5);
          ctx.lineTo(L.x + L.g, L.y + k * c + 0.5);
          ctx.stroke();
        }
        if (cursor >= 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(L.x + (cursor % n) * c + 1.5, L.y + Math.floor(cursor / n) * c + 1.5, c - 3, c - 3, c * 0.2);
          ctx.stroke();
        }

        const b = L.mode;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
        ctx.fill();
        ctx.stroke();
        const half = b.w / 2;
        ctx.fillStyle = mode === FILL ? "rgba(139,156,255,0.9)" : "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.roundRect(b.x + 3 + (mode === CROSS ? half : 0), b.y + 3, half - 6, b.h - 6, (b.h - 6) / 2);
        ctx.fill();
        ctx.font = "700 14px system-ui, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.fillText("Fill", b.x + half / 2, b.y + b.h / 2 + 1);
        ctx.fillText("Cross", b.x + half * 1.5, b.y + b.h / 2 + 1);

        if (s.solved)
          banner(ctx, { cx: W / 2, cy: L.y + L.g / 2, w: Math.min(W - 40, 300), title: "Picture done", detail: `+${150 * s.level - 30 * s.mistakes}`, hint: `Tap for picture ${s.level + 1}`, t: shown, colors: ["#a5b4fc", "#c084fc"], reducedMotion });
        else if (!s.alive)
          banner(ctx, { cx: W / 2, cy: L.y + L.g / 2, w: Math.min(W - 40, 300), title: "Three mistakes", detail: `Picture ${s.level} · ${s.score} points`, hint: "", t: shown, colors: ["#ffb199", "#ff5c7a"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as NonoState;
        flash = new Map();
        paint = null;
        shown = 0;
        overIn = s.alive ? -1 : 0.6;
        hot = 1;
      },
      destroy: off,
    };
  },
};

export default nonogram;
