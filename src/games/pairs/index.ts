import type { Action } from "@/engine/input";
import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { flip, newGame, nextBoard, sizeFor, tick, type PairsState } from "./logic";

const FLIP = 0.22; // s
const SHOW_MISS = 0.8; // s a missed pair stays up
const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#ef4444", "#6366f1", "#84cc16", "#f97316", "#0ea5e9"];

/** Twelve symbols, each a distinct shape in a distinct colour. */
function symbol(ctx: CanvasRenderingContext2D, id: number, cx: number, cy: number, r: number) {
  ctx.fillStyle = COLORS[id];
  ctx.strokeStyle = COLORS[id];
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  const poly = (n: number, rot = -Math.PI / 2, rr = r) => {
    for (let k = 0; k < n; k++) {
      const a = rot + (k * Math.PI * 2) / n;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  switch (id) {
    case 0: ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); break;
    case 1: ctx.roundRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, r * 0.25); ctx.fill(); break;
    case 2: poly(3, -Math.PI / 2, r * 1.1); ctx.fill(); break;
    case 3: poly(4, 0, r * 1.1); ctx.fill(); break;
    case 4: for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r * 1.1; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); break;
    case 5: ctx.moveTo(cx, cy + r * 0.9); ctx.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.6, cy - r * 1.3, cx, cy - r * 0.45); ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r * 0.9); ctx.fill(); break;
    case 6: poly(6, 0); ctx.fill(); break;
    case 7: ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2); ctx.stroke(); break;
    case 8: ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke(); break;
    case 9: ctx.arc(cx, cy, r, Math.PI * 0.35, Math.PI * 1.65); ctx.arc(cx + r * 0.45, cy, r * 0.75, Math.PI * 1.55, Math.PI * 0.45, true); ctx.fill(); break;
    case 10: ctx.moveTo(cx - r, cy - r * 0.6); ctx.lineTo(cx, cy + r * 0.6); ctx.lineTo(cx + r, cy - r * 0.6); ctx.stroke(); break;
    default: for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.moveTo(cx + dx * r * 0.5 + r * 0.32, cy + dy * r * 0.5); ctx.arc(cx + dx * r * 0.5, cy + dy * r * 0.5, r * 0.32, 0, Math.PI * 2); } ctx.fill();
  }
}

const pairs: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: PairsState = newGame(rng);
    const turning = new Map<number, number>(); // card → seconds into its flip
    let missT = 0;
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
      const avail = stage.height - ins.bottom - 10 - top - 52 - 20;
      const gap = 10;
      const cw = Math.min((stage.width - 24 - gap * (s.cols - 1)) / s.cols, ((avail - gap * (s.rows - 1)) / s.rows) * 0.78, 120);
      const ch = cw / 0.78;
      const bw = cw * s.cols + gap * (s.cols - 1), bh = ch * s.rows + gap * (s.rows - 1);
      const x = (stage.width - bw) / 2, y = top + 52 + Math.max(0, (avail - bh) / 2);
      return { x, y, cw, ch, gap, bw, bh, infoY: y - 52 };
    }
    const cardXY = (i: number) => ({ x: L.x + (i % s.cols) * (L.cw + L.gap), y: L.y + Math.floor(i / s.cols) * (L.ch + L.gap) });
    const cardAt = (px: number, py: number) => {
      for (let i = 0; i < s.cards.length; i++) {
        const p = cardXY(i);
        if (px >= p.x && px <= p.x + L.cw && py >= p.y && py <= p.y + L.ch) return i;
      }
      return -1;
    };
    const faceUp = (i: number) => s.matched[i] || s.open.includes(i);

    function doFlip(i: number) {
      const wasOpen = s.open.slice();
      const before = s.score;
      const r = flip(s, i);
      if (!r) return;
      if (!reducedMotion) {
        turning.set(i, 0);
        if (wasOpen.length === 2) wasOpen.forEach((k) => turning.set(k, 0)); // the miss turns back too
      }
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (r === "miss") missT = 0;
      if (r === "cleared") {
        emit({ type: "feel", kind: "success" });
        shown = 0;
      } else emit({ type: "feel", kind: r === "match" ? "score" : "tap" });
    }
    function next() {
      nextBoard(s, rng);
      turning.clear();
      L = layout();
      emit({ type: "feel", kind: "tap" });
    }

    function onAction(a: Action) {
      if (s.cleared) return void (a === "primary" && next());
      if (!s.alive) return;
      if (cursor < 0) return void (cursor = 0);
      const r = Math.floor(cursor / s.cols), c = cursor % s.cols;
      if (a === "left") cursor = r * s.cols + Math.max(0, c - 1);
      else if (a === "right") cursor = r * s.cols + Math.min(s.cols - 1, c + 1);
      else if (a === "up") cursor = Math.max(0, r - 1) * s.cols + c;
      else if (a === "down") cursor = Math.min(s.rows - 1, r + 1) * s.cols + c;
      else if (a === "primary") doFlip(cursor);
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "action") return onAction(e.action);
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        cursor = -1;
        press = s.cleared ? "next" : null;
        pressed = s.alive && !s.cleared ? cardAt(e.x, e.y) : -1;
        if (pressed >= 0) doFlip(pressed); // cards turn on press: memory games are about speed
      } else if (e.phase === "end") {
        if (press === "next" && shown > 0.5) next();
        press = null;
        pressed = -1;
      }
    });

    return {
      update(dt) {
        const wasAlive = s.alive;
        tick(s, dt);
        if (wasAlive && !s.alive) {
          emit({ type: "feel", kind: "fail" });
          shown = 0;
          overIn = 1.7;
        }
        if (s.open.length === 2 && (missT += dt) >= SHOW_MISS) {
          s.open.forEach((k) => !reducedMotion && turning.set(k, 0));
          s.open = []; // the miss turns back on its own after a moment
        }
        for (const [k, t] of turning) {
          if (t + dt >= FLIP) turning.delete(k);
          else turning.set(k, t + dt);
        }
        if (s.cleared || !s.alive) {
          if (shown < 1) shown = Math.min(1, shown + dt / 0.35);
          if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
        }
        hot = 1; // the timer always moves while playing
      },

      render() {
        if (hot <= 0 && stage.width === lastW && stage.height === lastH) return;
        lastW = stage.width;
        lastH = stage.height;
        L = layout();
        const W = stage.width, H = stage.height;
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, L.y + L.bh / 2, 0, W / 2, L.y + L.bh / 2, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(238,156,167,0.22)");
        glow.addColorStop(0.5, "rgba(199,144,129,0.07)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        pill(ctx, L.x, L.infoY, L.bw, 40, null);
        const full = sizeFor(s.level).time;
        const f = s.time / full;
        ctx.fillStyle = f < 0.2 ? "rgba(255,92,122,0.55)" : "rgba(238,156,167,0.35)";
        ctx.beginPath();
        ctx.roundRect(L.x + 3, L.infoY + 3, Math.max(0, (L.bw - 6) * f), 34, 17);
        ctx.fill();
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillText(`Board ${s.level}${s.streak > 1 ? ` · streak ×${s.streak}` : ""}`, L.x + 16, L.infoY + 21);
        ctx.textAlign = "right";
        ctx.fillText(`${Math.ceil(s.time)}s`, L.x + L.bw - 16, L.infoY + 21);

        for (let i = 0; i < s.cards.length; i++) {
          const p = cardXY(i);
          const t = turning.get(i);
          const up = faceUp(i);
          // A flip squashes the card to an edge and opens it on the other side.
          const k = t === undefined ? 1 : Math.abs(Math.cos((t / FLIP) * Math.PI));
          const showFace = t === undefined ? up : t / FLIP < 0.5 ? !up : up;
          const w = L.cw * Math.max(0.03, k);
          const x = p.x + (L.cw - w) / 2;
          ctx.save();
          ctx.globalAlpha = s.matched[i] && t === undefined ? 0.45 : 1;
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 5;
          if (showFace) {
            ctx.fillStyle = "#fbf7f8";
            ctx.beginPath();
            ctx.roundRect(x, p.y, w, L.ch, 12);
            ctx.fill();
            ctx.shadowColor = "transparent";
            if (k > 0.3) {
              ctx.save();
              ctx.translate(p.x + L.cw / 2, 0);
              ctx.scale(k, 1);
              symbol(ctx, s.cards[i], 0, p.y + L.ch / 2, L.cw * 0.24);
              ctx.restore();
            }
          } else {
            const g = ctx.createLinearGradient(x, p.y, x + w, p.y + L.ch);
            g.addColorStop(0, "#ee9ca7");
            g.addColorStop(1, "#b06a7a");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.roundRect(x, p.y, w, L.ch, 12);
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.strokeStyle = "rgba(255,255,255,0.35)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(x + 6 * k, p.y + 6, Math.max(0, w - 12 * k), L.ch - 12, 8);
            ctx.stroke();
          }
          ctx.restore();
          if (i === cursor) {
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(p.x - 3, p.y - 3, L.cw + 6, L.ch + 6, 14);
            ctx.stroke();
          }
        }

        if (s.cleared)
          banner(ctx, { cx: W / 2, cy: L.y + L.bh / 2, w: Math.min(W - 40, 300), title: "Board cleared", detail: `${Math.ceil(s.time)}s to spare`, hint: `Tap for board ${s.level + 1}`, t: shown, colors: ["#ffdde1", "#ee9ca7"], reducedMotion });
        else if (!s.alive)
          banner(ctx, { cx: W / 2, cy: L.y + L.bh / 2, w: Math.min(W - 40, 300), title: "Time's up", detail: `Board ${s.level} · ${s.score} points`, hint: "", t: shown, colors: ["#ffb199", "#ff5c7a"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as PairsState;
        turning.clear();
        shown = 0;
        overIn = s.alive ? -1 : 0.6;
        hot = 1;
      },
      destroy: off,
    };
  },
};

export default pairs;
