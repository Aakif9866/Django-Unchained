import type { Action } from "@/engine/input";
import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { FLAG, OPEN, dig, flag, flagsLeft, minesAround, newGame, nextBoard, type MineState } from "./logic";

const HOLD = 0.35; // s held without moving = flag
const RIPPLE = 0.03; // s per flood ring
const OPEN_T = 0.16;
const NUM = ["", "#7dd3fc", "#86efac", "#fda4af", "#c4b5fd", "#fdba74", "#67e8f9", "#f9a8d4", "#e5e7eb"];

const minefield: GameModule = {
  kind: "2d",
  create({ difficulty, stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: MineState = newGame(difficulty);
    const opening = new Map<number, number>(); // cell → time since its ripple started (negative = waiting)
    let mode: "dig" | "flag" = "dig";
    let hold: { cell: number; t: number; fired: boolean; moved: boolean } | null = null;
    let press: "mode" | "next" | null = null;
    let cursor = -1;
    let shown = 0;
    let overIn = -1;
    let hot = 1;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const top = ins.top + 10;
      const avail = stage.height - ins.bottom - 10 - top - 52 - 70;
      const cell = Math.max(18, Math.floor(Math.min((stage.width - 24) / s.cols, avail / s.rows, 64)));
      const bw = cell * s.cols, bh = cell * s.rows;
      const x = Math.round((stage.width - bw) / 2);
      const y = Math.round(top + 52 + Math.max(0, (avail - bh) / 2));
      return { x, y, cell, bw, bh, infoY: y - 52, mode: { x: stage.width / 2 - 80, y: y + bh + 18, w: 160, h: 46 } };
    }
    const cellAt = (px: number, py: number) => {
      const c = Math.floor((px - L.x) / L.cell), r = Math.floor((py - L.y) / L.cell);
      return c >= 0 && c < s.cols && r >= 0 && r < s.rows ? r * s.cols + c : -1;
    };
    const inRect = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

    function doDig(cell: number) {
      const before = s.score;
      const d = dig(s, cell, rng);
      if (!reducedMotion) for (const o of d.opened) opening.set(o.cell, -o.ring * RIPPLE);
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (d.boom) {
        emit({ type: "feel", kind: "fail" });
        overIn = 1.7;
        shown = 0;
      } else if (d.cleared) {
        emit({ type: "feel", kind: "success" });
        shown = 0;
      } else if (d.opened.length) emit({ type: "feel", kind: d.opened.length > 1 ? "score" : "tap" });
    }
    function doFlag(cell: number) {
      if (flag(s, cell)) emit({ type: "feel", kind: "tap" });
    }
    const act = (cell: number, alt: boolean) => ((mode === "flag") !== alt ? doFlag(cell) : doDig(cell));
    function next() {
      nextBoard(s);
      opening.clear();
      hold = null;
      L = layout();
      emit({ type: "feel", kind: "tap" });
    }

    function onAction(a: Action) {
      if (s.cleared) {
        if (a === "primary") next();
        return;
      }
      if (!s.alive) return;
      if (cursor < 0) {
        cursor = Math.floor(s.rows / 2) * s.cols + Math.floor(s.cols / 2); // the first key only reveals the cursor
        return;
      }
      const r = Math.floor(cursor / s.cols), c = cursor % s.cols;
      if (a === "left") cursor = r * s.cols + Math.max(0, c - 1);
      else if (a === "right") cursor = r * s.cols + Math.min(s.cols - 1, c + 1);
      else if (a === "up") cursor = Math.max(0, r - 1) * s.cols + c;
      else if (a === "down") cursor = Math.min(s.rows - 1, r + 1) * s.cols + c;
      else if (a === "primary") doDig(cursor);
      else if (a === "secondary") doFlag(cursor);
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "action") return onAction(e.action);
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        cursor = -1;
        press = s.cleared ? "next" : inRect(L.mode, e.x, e.y) && s.alive ? "mode" : null;
        const cell = s.alive && !s.cleared ? cellAt(e.x, e.y) : -1;
        hold = cell >= 0 ? { cell, t: 0, fired: false, moved: false } : null;
      } else if (e.phase === "move") {
        if (hold && Math.hypot(e.dx, e.dy) > 10) hold.moved = true; // a drag is never a tap or a hold
      } else {
        if (press === "mode" && inRect(L.mode, e.x, e.y)) {
          mode = mode === "dig" ? "flag" : "dig";
          emit({ type: "feel", kind: "tap" });
        } else if (press === "next" && shown > 0.5) next();
        if (hold && !hold.fired && !hold.moved) act(hold.cell, false);
        hold = null;
        press = null;
      }
    });

    function closedTile(x: number, y: number, c: number, k = 1) {
      const m = (c * (1 - k)) / 2;
      const g = ctx.createLinearGradient(x, y, x, y + c);
      g.addColorStop(0, "#6fcf4a");
      g.addColorStop(1, "#2f8a3e");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + 2 + m, y + 2 + m, (c - 4) * k, (c - 4) * k, c * 0.2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.roundRect(x + 4 + m, y + 3 + m, (c - 8) * k, (c - 4) * k * 0.32, c * 0.14);
      ctx.fill();
    }
    function flagGlyph(x: number, y: number, c: number) {
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = Math.max(1.5, c * 0.06);
      ctx.beginPath();
      ctx.moveTo(x + c * 0.38, y + c * 0.24);
      ctx.lineTo(x + c * 0.38, y + c * 0.76);
      ctx.stroke();
      ctx.fillStyle = "#ff3b5c";
      ctx.beginPath();
      ctx.moveTo(x + c * 0.4, y + c * 0.24);
      ctx.lineTo(x + c * 0.72, y + c * 0.36);
      ctx.lineTo(x + c * 0.4, y + c * 0.5);
      ctx.fill();
    }
    function mineGlyph(x: number, y: number, c: number) {
      const cx = x + c / 2, cy = y + c / 2, r = c * 0.2;
      ctx.strokeStyle = "#0b0f14";
      ctx.lineWidth = Math.max(1.5, c * 0.06);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 4;
        ctx.moveTo(cx - Math.cos(a) * r * 1.6, cy - Math.sin(a) * r * 1.6);
        ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
      }
      ctx.stroke();
      ctx.fillStyle = "#0b0f14";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    return {
      update(dt) {
        if (hold && !hold.fired && !hold.moved && s.alive && !s.cleared) {
          hold.t += dt;
          if (hold.t >= HOLD) {
            hold.fired = true; // the hold itself is the flag, so the release does nothing
            act(hold.cell, true);
            hot = 1;
          }
        }
        if (opening.size) {
          for (const [cell, t] of opening) {
            if (t + dt >= OPEN_T) opening.delete(cell);
            else opening.set(cell, t + dt);
          }
          hot = 1;
        }
        if (!s.alive || s.cleared) {
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
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, L.y + L.bh * 0.4, 0, W / 2, L.y + L.bh * 0.4, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(86,171,47,0.24)");
        glow.addColorStop(0.5, "rgba(168,224,99,0.06)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        pill(ctx, L.x, L.infoY, L.bw, 40, null);
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(`Board ${s.level}`, L.x + 16, L.infoY + 21);
        ctx.textAlign = "right";
        flagGlyph(L.x + L.bw - 50 - 16, L.infoY + 6, 28);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(String(flagsLeft(s)), L.x + L.bw - 16, L.infoY + 21);

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "#14201a";
        ctx.beginPath();
        ctx.roundRect(L.x - 6, L.y - 6, L.bw + 12, L.bh + 12, 16);
        ctx.fill();
        ctx.restore();

        for (let i = 0; i < s.cols * s.rows; i++) {
          const x = L.x + (i % s.cols) * c, y = L.y + Math.floor(i / s.cols) * c;
          const m = s.marks[i];
          const mine = s.mines?.[i] === 1;
          const t = opening.get(i);
          if (m === OPEN && t === undefined) {
            ctx.fillStyle = "rgba(255,255,255,0.045)";
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, c - 2, c - 2, c * 0.16);
            ctx.fill();
            const n = minesAround(s, i);
            if (n) {
              ctx.fillStyle = NUM[n];
              ctx.font = `800 ${Math.round(c * 0.5)}px system-ui, sans-serif`;
              ctx.textAlign = "center";
              ctx.fillText(String(n), x + c / 2, y + c / 2 + c * 0.03);
            }
          } else if (m === OPEN) {
            closedTile(x, y, c, 1 - Math.max(0, t!) / OPEN_T); // shrinking away as it opens
          } else if (!s.alive && mine) {
            ctx.fillStyle = i === s.boom ? "#ff3b5c" : "rgba(255,255,255,0.12)";
            ctx.beginPath();
            ctx.roundRect(x + 2, y + 2, c - 4, c - 4, c * 0.2);
            ctx.fill();
            mineGlyph(x, y, c);
          } else {
            const pressed = hold?.cell === i && !hold.moved && !hold.fired;
            closedTile(x, y, c, pressed && !reducedMotion ? 0.9 : 1);
            if (m === FLAG) flagGlyph(x, y, c);
            if (!s.alive && m === FLAG && !mine) {
              ctx.strokeStyle = "#ff3b5c"; // a wrong flag
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x + c * 0.25, y + c * 0.25);
              ctx.lineTo(x + c * 0.75, y + c * 0.75);
              ctx.stroke();
            }
            if (pressed && hold!.t > 0.08) {
              ctx.strokeStyle = "rgba(255,255,255,0.9)"; // the hold fills a ring toward a flag
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(x + c / 2, y + c / 2, c * 0.36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, hold!.t / HOLD));
              ctx.stroke();
              hot = Math.max(hot, 0.1);
            }
          }
          if (i === cursor) {
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(x + 1.5, y + 1.5, c - 3, c - 3, c * 0.2);
            ctx.stroke();
          }
        }

        // Dig / Flag toggle under your thumb (holding a tile always flags).
        const b = L.mode;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
        ctx.fill();
        ctx.stroke();
        const half = b.w / 2;
        ctx.fillStyle = mode === "dig" ? "rgba(111,207,74,0.9)" : "rgba(255,59,92,0.9)";
        ctx.beginPath();
        ctx.roundRect(b.x + 3 + (mode === "flag" ? half : 0), b.y + 3, half - 6, b.h - 6, (b.h - 6) / 2);
        ctx.fill();
        ctx.font = "700 14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText("Dig", b.x + half / 2, b.y + b.h / 2 + 1);
        ctx.fillText("Flag", b.x + half * 1.5, b.y + b.h / 2 + 1);

        if (!s.alive)
          banner(ctx, { cx: W / 2, cy: L.y + L.bh / 2, w: Math.min(L.bw - 16, 300), title: "Boom", detail: `Board ${s.level} · ${s.score} points`, hint: "", t: shown, colors: ["#ff9a8b", "#ff3b5c"], reducedMotion });
        else if (s.cleared)
          banner(ctx, { cx: W / 2, cy: L.y + L.bh / 2, w: Math.min(L.bw - 16, 300), title: "Board cleared", detail: `+${100 * s.level} bonus`, hint: `Tap for board ${s.level + 1}`, t: shown, colors: ["#d4fc79", "#56ab2f"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as MineState;
        opening.clear();
        hold = null;
        shown = 0;
        overIn = s.alive ? -1 : 0.6;
        hot = 1;
      },
      destroy: off,
    };
  },
};

export default minefield;
