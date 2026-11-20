import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import {
  MAX_PASSES, autoFinishStep, autoTarget, canDraw, carried, draw, isRed, legal, move, newGame, nextDeal, rankOf, stuck, suitOf,
  type From, type SolState, type To,
} from "./logic";

const FLY = 0.16; // s
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** Suit shapes drawn as paths (consistent on every device, unlike emoji). */
function suit(ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number, r: number) {
  ctx.beginPath();
  if (s === 1) {
    ctx.moveTo(cx, cy + r);
    ctx.bezierCurveTo(cx - r * 1.7, cy - r * 0.15, cx - r * 0.65, cy - r * 1.35, cx, cy - r * 0.45);
    ctx.bezierCurveTo(cx + r * 0.65, cy - r * 1.35, cx + r * 1.7, cy - r * 0.15, cx, cy + r);
  } else if (s === 2) {
    ctx.moveTo(cx, cy - r * 1.1);
    ctx.lineTo(cx + r * 0.8, cy);
    ctx.lineTo(cx, cy + r * 1.1);
    ctx.lineTo(cx - r * 0.8, cy);
  } else if (s === 0) {
    ctx.moveTo(cx, cy - r * 1.05);
    ctx.bezierCurveTo(cx - r * 1.7, cy + r * 0.15, cx - r * 0.6, cy + r * 1.1, cx - r * 0.08, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.35, cy + r * 1.05);
    ctx.lineTo(cx + r * 0.35, cy + r * 1.05);
    ctx.lineTo(cx + r * 0.08, cy + r * 0.45);
    ctx.bezierCurveTo(cx + r * 0.6, cy + r * 1.1, cx + r * 1.7, cy + r * 0.15, cx, cy - r * 1.05);
  } else {
    for (const [dx, dy] of [[0, -0.5], [-0.52, 0.18], [0.52, 0.18]]) {
      ctx.moveTo(cx + dx * r + r * 0.48, cy + dy * r);
      ctx.arc(cx + dx * r, cy + dy * r, r * 0.48, 0, Math.PI * 2);
    }
    ctx.moveTo(cx - r * 0.12, cy + r * 0.1);
    ctx.lineTo(cx - r * 0.35, cy + r * 1.05);
    ctx.lineTo(cx + r * 0.35, cy + r * 1.05);
    ctx.lineTo(cx + r * 0.12, cy + r * 0.1);
  }
  ctx.closePath();
  ctx.fill();
}

const solitaire: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: SolState = newGame(rng);
    let drag: { from: From; cards: number[]; x: number; y: number; ox: number; oy: number; moved: boolean } | null = null;
    const flights = new Map<number, { x: number; y: number; t: number }>(); // card → where it flew from
    let shake: { card: number; t: number } | null = null;
    let finishT = 0;
    let confirm = 0;
    let press: "giveup" | "next" | null = null;
    let shown = 0;
    let overIn = -1;
    let hot = 1;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const top = ins.top + 8;
      const gap = Math.max(5, Math.min(12, stage.width * 0.015));
      const w = Math.floor(Math.min((stage.width - 16 - gap * 6) / 7, 96));
      const h = Math.round(w * 1.4);
      const x0 = Math.round((stage.width - (w * 7 + gap * 6)) / 2);
      const rowY = top + 50;
      const tabY = rowY + h + 16;
      const bottom = stage.height - ins.bottom - 8;
      return { w, h, gap, x0, infoY: top, rowY, tabY, bottom, giveup: { x: x0 + w * 7 + gap * 6 - 96, y: top, w: 96, h: 40 } };
    }
    const colX = (c: number) => L.x0 + c * (L.w + L.gap);
    /** Face-down and face-up spacing for a column, squeezed if it would run off the bottom. */
    function spacing(c: number) {
      const col = s.tab[c], d = s.down[c];
      let dn = L.h * 0.12, up = L.h * 0.27;
      const need = d * dn + Math.max(0, col.length - d - 1) * up + L.h;
      const room = L.bottom - L.tabY;
      if (need > room) {
        const k = (room - L.h) / Math.max(1, need - L.h);
        dn *= k;
        up *= k;
      }
      return { dn, up };
    }
    const cardY = (c: number, i: number) => {
      const { dn, up } = spacing(c);
      const d = s.down[c];
      return L.tabY + Math.min(i, d) * dn + Math.max(0, i - d) * up;
    };
    /** Screen position of every visible card (for flights and hit tests). */
    function positions(): Map<number, { x: number; y: number }> {
      const m = new Map<number, { x: number; y: number }>();
      s.tab.forEach((col, c) => col.forEach((card, i) => m.set(card, { x: colX(c), y: cardY(c, i) })));
      if (s.waste.length) m.set(s.waste[s.waste.length - 1], { x: colX(1), y: L.rowY });
      s.found.forEach((p, k) => p.length && m.set(p[p.length - 1], { x: colX(3 + k), y: L.rowY }));
      return m;
    }
    const inRect = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    const at = (x: number, y: number, cx: number, cy: number) => x >= cx && x <= cx + L.w && y >= cy && y <= cy + L.h;

    /** What's under the finger: a source to pick up. */
    function sourceAt(x: number, y: number): From | null {
      for (let c = 0; c < 7; c++) {
        const col = s.tab[c];
        for (let i = col.length - 1; i >= s.down[c]; i--) if (at(x, y, colX(c), cardY(c, i))) return { kind: "tab", col: c, idx: i };
      }
      if (s.waste.length && at(x, y, colX(1), L.rowY)) return { kind: "waste" };
      for (let k = 0; k < 4; k++) if (s.found[k].length && at(x, y, colX(3 + k), L.rowY)) return { kind: "found", suit: k };
      return null;
    }
    /** Where a dragged card is dropped (by the card's centre). */
    function targetAt(x: number, y: number): To | null {
      if (y < L.rowY + L.h + 8) return x >= colX(3) - L.gap / 2 ? { kind: "found" } : null;
      for (let c = 0; c < 7; c++) if (x >= colX(c) - L.gap / 2 && x < colX(c) + L.w + L.gap / 2) return { kind: "tab", col: c };
      return null;
    }

    function doMove(f: From, t: To) {
      const before = positions();
      const cards = carried(s, f);
      const prev = s.score;
      const r = move(s, f, t);
      if (!r) return false;
      if (!reducedMotion) for (const c of cards) if (before.has(c)) flights.set(c, { ...before.get(c)!, t: 0 });
      if (s.score !== prev) emit({ type: "score", value: s.score });
      if (r.won) {
        emit({ type: "feel", kind: "success" });
        shown = 0;
      } else emit({ type: "feel", kind: t.kind === "found" ? "score" : "tap" });
      checkStuck();
      return true;
    }
    function doDraw() {
      if (!draw(s)) return;
      if (!reducedMotion && s.waste.length) flights.set(s.waste[s.waste.length - 1], { x: colX(0), y: L.rowY, t: 0 });
      emit({ type: "feel", kind: "tap" });
      checkStuck();
    }
    function checkStuck() {
      if (stuck(s)) {
        s.alive = false;
        emit({ type: "feel", kind: "fail" });
        shown = 0;
        overIn = 1.8;
      }
    }
    function giveUpTap() {
      if (!s.alive || s.won) return;
      if (confirm > 0) {
        s.alive = false;
        shown = 0;
        overIn = 1.4;
        emit({ type: "feel", kind: "fail" });
      } else confirm = 3;
    }
    function next() {
      nextDeal(s, rng);
      flights.clear();
      emit({ type: "feel", kind: "tap" });
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "action") {
        if (s.won) return void (e.action === "primary" && next());
        if (e.action === "primary") doDraw();
        else if (e.action === "up") {
          // Keyboard: send the waste card, else any card that can go up, to its best place.
          const f: From = { kind: "waste" };
          const t = autoTarget(s, f);
          if (t) doMove(f, t);
        } else if (e.action === "secondary") giveUpTap();
        return;
      }
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        press = s.won ? "next" : inRect(L.giveup, e.x, e.y) ? "giveup" : null;
        if (press || !s.alive || s.won) return;
        if (at(e.x, e.y, colX(0), L.rowY)) return void doDraw(); // the stock answers on press
        const f = sourceAt(e.x, e.y);
        if (!f) return;
        const pos = f.kind === "tab" ? { x: colX(f.col), y: cardY(f.col, f.idx) } : f.kind === "waste" ? { x: colX(1), y: L.rowY } : { x: colX(3 + f.suit), y: L.rowY };
        drag = { from: f, cards: carried(s, f), x: e.x, y: e.y, ox: pos.x - e.x, oy: pos.y - e.y, moved: false };
      } else if (e.phase === "move") {
        if (!drag) return;
        drag.x = e.x;
        drag.y = e.y;
        if (Math.hypot(e.dx, e.dy) > 6) drag.moved = true;
      } else {
        if (press === "giveup" && inRect(L.giveup, e.x, e.y)) giveUpTap();
        else if (press === "next" && shown > 0.5) next();
        press = null;
        const d = drag;
        drag = null;
        if (!d) return;
        if (d.moved) {
          const t = targetAt(d.x + d.ox + L.w / 2, d.y + d.oy + L.h / 2);
          if (t && legal(s, d.from, t)) doMove(d.from, t);
        } else {
          // A tap sends the card to its best place.
          const t = autoTarget(s, d.from);
          if (t) doMove(d.from, t);
          else {
            shake = { card: d.cards[0], t: 0 };
            emit({ type: "feel", kind: "tap" });
          }
        }
      }
    });

    function back(x: number, y: number) {
      const g = ctx.createLinearGradient(x, y, x + L.w, y + L.h);
      g.addColorStop(0, "#1f6f78");
      g.addColorStop(1, "#134e5e");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, L.w, L.h, L.w * 0.12);
      ctx.fill();
      ctx.strokeStyle = "rgba(201,255,191,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x + L.w * 0.12, y + L.w * 0.12, L.w * 0.76, L.h - L.w * 0.24, L.w * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + L.w / 2, y + L.h / 2, L.w * 0.18, 0, Math.PI * 2);
      ctx.stroke();
    }
    function face(card: number, x: number, y: number, lifted = false) {
      ctx.save();
      ctx.shadowColor = lifted ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.25)";
      ctx.shadowBlur = lifted ? 18 : 4;
      ctx.shadowOffsetY = lifted ? 8 : 1;
      ctx.fillStyle = "#fdfcf8";
      ctx.beginPath();
      ctx.roundRect(x, y, L.w, L.h, L.w * 0.12);
      ctx.fill();
      ctx.restore();
      const ink = isRed(card) ? "#e11d48" : "#111827";
      ctx.fillStyle = ink;
      ctx.font = `800 ${Math.round(L.w * 0.32)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(RANKS[rankOf(card)], x + L.w * 0.09, y + L.w * 0.07);
      suit(ctx, suitOf(card), x + L.w * 0.8, y + L.w * 0.22, L.w * 0.12);
      suit(ctx, suitOf(card), x + L.w / 2, y + L.h * 0.62, L.w * 0.24);
    }
    const slot = (x: number, y: number, label = "") => {
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x + 0.75, y + 0.75, L.w - 1.5, L.h - 1.5, L.w * 0.12);
      ctx.stroke();
      if (label) {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font = `700 ${Math.round(L.w * 0.3)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + L.w / 2, y + L.h / 2);
      }
    };

    return {
      update(dt) {
        for (const [c, f] of flights) {
          if ((f.t += dt) >= FLY) flights.delete(c);
        }
        if (shake && (shake.t += dt) > 0.3) shake = null;
        if (confirm > 0) confirm -= dt;
        // Once everything is face up and the stock is spent, the cards fly home on their own.
        if (s.alive && !s.won && (finishT += dt) > 0.09) {
          finishT = 0;
          const step = autoFinishStep(s);
          if (step) doMove(...step);
        }
        if (s.won || !s.alive) {
          if (shown < 1) shown = Math.min(1, shown + dt / 0.35);
          if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
        }
        if (flights.size || shake || confirm > 0 || shown < 1) hot = 1;
        hot = Math.max(0, hot - dt);
      },

      render() {
        if (hot <= 0 && stage.width === lastW && stage.height === lastH) return;
        lastW = stage.width;
        lastH = stage.height;
        L = layout();
        const W = stage.width, H = stage.height;
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.8);
        glow.addColorStop(0, "rgba(113,178,128,0.26)");
        glow.addColorStop(0.5, "rgba(19,78,94,0.16)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        pill(ctx, L.x0, L.infoY, L.giveup.x - L.x0 - 8, 40, null);
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(`Deal ${s.level} · pass ${s.passes} of ${MAX_PASSES}`, L.x0 + 14, L.infoY + 21);
        const g = L.giveup;
        ctx.fillStyle = confirm > 0 ? "rgba(244,63,94,0.9)" : press === "giveup" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(g.x, g.y, g.w, g.h, g.h / 2);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = s.alive && !s.won ? "#fff" : "rgba(255,255,255,0.3)";
        ctx.fillText(confirm > 0 ? "Sure?" : "Give up", g.x + g.w / 2, g.y + g.h / 2 + 1);

        const pos = positions();
        const draggingSet = new Set(drag?.moved ? drag.cards : []);
        const drawCard = (card: number, x: number, y: number) => {
          if (draggingSet.has(card)) return;
          const f = flights.get(card);
          if (f) {
            const e = 1 - Math.pow(1 - f.t / FLY, 3);
            x = f.x + (x - f.x) * e;
            y = f.y + (y - f.y) * e;
          }
          if (shake?.card === card && !reducedMotion) x += Math.sin(shake.t * 50) * 4 * (1 - shake.t / 0.3);
          face(card, x, y);
        };

        // Top row: stock, waste, foundations.
        if (s.stock.length) back(colX(0), L.rowY);
        else slot(colX(0), L.rowY, canDraw(s) ? "↻" : "");
        if (s.waste.length > 1) face(s.waste[s.waste.length - 2], colX(1), L.rowY);
        else slot(colX(1), L.rowY);
        if (s.waste.length) drawCard(s.waste[s.waste.length - 1], colX(1), L.rowY);
        for (let k = 0; k < 4; k++) {
          const p = s.found[k];
          slot(colX(3 + k), L.rowY, "A");
          if (p.length > 1) face(p[p.length - 2], colX(3 + k), L.rowY);
          if (p.length) drawCard(p[p.length - 1], colX(3 + k), L.rowY);
        }
        // Tableau.
        for (let c = 0; c < 7; c++) {
          const col = s.tab[c];
          if (!col.length) slot(colX(c), L.tabY, "K");
          col.forEach((card, i) => {
            if (i < s.down[c]) back(colX(c), cardY(c, i));
            else drawCard(card, pos.get(card)!.x, pos.get(card)!.y);
          });
        }
        // Cards in flight from the waste / foundations land on top.
        if (drag?.moved) {
          const { up } = spacing(drag.from.kind === "tab" ? drag.from.col : 0);
          drag.cards.forEach((card, i) => face(card, drag!.x + drag!.ox, drag!.y + drag!.oy + i * Math.max(up, L.h * 0.22), true));
        }

        const cy = L.tabY + L.h * 1.2;
        if (s.won)
          banner(ctx, { cx: W / 2, cy, w: Math.min(W - 40, 300), title: "Solved", detail: `+${300 * s.level} · ${s.score} points`, hint: `Tap for deal ${s.level + 1}`, t: shown, colors: ["#c9ffbf", "#71b280"], reducedMotion });
        else if (!s.alive)
          banner(ctx, { cx: W / 2, cy, w: Math.min(W - 40, 300), title: stuck(s) ? "No moves left" : "Gave up", detail: `Deal ${s.level} · ${s.score} points`, hint: "", t: shown, colors: ["#ffb199", "#ff5c7a"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as SolState;
        drag = null;
        flights.clear();
        shown = 0;
        overIn = s.alive ? -1 : 0.6;
        hot = 1;
      },
      destroy: off,
    };
  },
};

export default solitaire;
