import type { Dir } from "@/engine/input";
import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { SIZE, maxTile, move, newGame, undo, type Moved, type T48State } from "./logic";

const SLIDE = 0.1; // s
const POP = 0.14;
// [gradient from, gradient to, text] per tile value; past 2048 they all glow cyan → indigo.
const TILES: Record<number, [string, string, string]> = {
  2: ["#3d3656", "#342e4b", "#f5f3ff"],
  4: ["#4f416f", "#453963", "#f5f3ff"],
  8: ["#ffb347", "#ff8c42", "#2b1600"],
  16: ["#ff9f4a", "#ff6f3c", "#2b1000"],
  32: ["#ff7e5f", "#ff4f5a", "#ffffff"],
  64: ["#ff5f6d", "#e8336f", "#ffffff"],
  128: ["#ffe08a", "#ffc93a", "#3a2500"],
  256: ["#ffd95e", "#ffb81f", "#3a2500"],
  512: ["#ffc93d", "#ff9f1c", "#3a2000"],
  1024: ["#c084fc", "#8b5cf6", "#ffffff"],
  2048: ["#f472b6", "#a855f7", "#ffffff"],
};
const BEYOND: [string, string, string] = ["#22d3ee", "#6366f1", "#ffffff"];

const twenty48: GameModule = {
  kind: "2d",
  create({ difficulty, stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: T48State = newGame(rng, difficulty);
    let anim: (Moved & { prev: number[]; t: number }) | null = null;
    let armed = false; // one move per swipe gesture
    let press: "undo" | null = null;
    let toast = 0; // "2048!" message
    let overIn = -1;
    let shown = 0;
    let hot = 1;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const top = ins.top + 10;
      const avail = stage.height - ins.bottom - 10 - top - 120;
      const size = Math.max(200, Math.min(stage.width - 32, avail, 520));
      const x = Math.round((stage.width - size) / 2);
      const y = Math.round(top + 52 + Math.max(0, (avail - size) / 2));
      const gap = Math.round(size * 0.028);
      const cell = (size - gap * (SIZE + 1)) / SIZE;
      return { x, y, size, gap, cell, infoY: y - 52, undo: { x: stage.width / 2 - 60, y: y + size + 18, w: 120, h: 44 } };
    }
    const cellXY = (i: number) => ({ x: L.x + L.gap + (i % SIZE) * (L.cell + L.gap), y: L.y + L.gap + Math.floor(i / SIZE) * (L.cell + L.gap) });

    function slide(dir: Dir) {
      if (s.over) return;
      const prev = s.board.slice();
      const before = s.score;
      const m = move(s, dir, rng);
      if (!m) return;
      anim = reducedMotion ? null : { ...m, prev, t: 0 }; // a new move simply starts from the finished last one
      if (s.score !== before) emit({ type: "score", value: s.score });
      emit({ type: "feel", kind: m.reachedGoal ? "success" : m.merges.length ? "score" : "tap" });
      if (m.reachedGoal) toast = 2.6;
      if (s.over) {
        overIn = 1.4;
        shown = 0;
        emit({ type: "feel", kind: "fail" });
      }
    }

    function stepBack() {
      const before = s.score;
      if (!undo(s, rng)) return;
      anim = null;
      if (s.score !== before) emit({ type: "score", value: s.score });
      emit({ type: "feel", kind: "tap" });
    }

    const inUndo = (x: number, y: number) => x >= L.undo.x && x <= L.undo.x + L.undo.w && y >= L.undo.y && y <= L.undo.y + L.undo.h;
    const off = input.on((e) => {
      hot = 1;
      if (e.type === "drag") {
        if (e.phase === "start") {
          press = inUndo(e.x, e.y) ? "undo" : null;
          armed = !press;
        } else if (e.phase === "end") {
          if (press === "undo" && inUndo(e.x, e.y)) stepBack();
          press = null;
        }
      } else if (e.type === "swipe") {
        if (armed) {
          armed = false;
          slide(e.dir); // moves the moment the swipe is recognised, not on release
        }
      } else if (e.type === "action") {
        if (e.action === "secondary") stepBack();
        else if (e.action === "up" || e.action === "down" || e.action === "left" || e.action === "right") slide(e.action);
      }
    });

    function tile(v: number, x: number, y: number, k = 1) {
      const [a, b, text] = TILES[v] ?? BEYOND;
      const c = L.cell * k;
      const ox = x + (L.cell - c) / 2, oy = y + (L.cell - c) / 2;
      const g = ctx.createLinearGradient(ox, oy, ox + c, oy + c);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      ctx.save();
      if (v >= 1024) {
        ctx.shadowColor = b;
        ctx.shadowBlur = c * 0.35;
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(ox, oy, c, c, c * 0.16);
      ctx.fill();
      ctx.restore();
      const sheen = ctx.createLinearGradient(0, oy, 0, oy + c * 0.55);
      sheen.addColorStop(0, "rgba(255,255,255,0.16)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.roundRect(ox, oy, c, c, c * 0.16);
      ctx.fill();
      const digits = String(v).length;
      ctx.fillStyle = text;
      ctx.font = `800 ${Math.round(c * (digits <= 2 ? 0.46 : digits === 3 ? 0.38 : digits === 4 ? 0.3 : 0.25))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(v), ox + c / 2, oy + c / 2 + c * 0.03);
    }

    return {
      update(dt) {
        if (anim) {
          anim.t += dt;
          if (anim.t >= SLIDE + POP) anim = null;
          hot = 1;
        }
        if (toast > 0) {
          toast -= dt;
          hot = 1;
        }
        if (s.over) {
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
        const W = stage.width, H = stage.height;
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, L.y + L.size * 0.4, 0, W / 2, L.y + L.size * 0.4, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(255,126,95,0.26)");
        glow.addColorStop(0.5, "rgba(255,204,51,0.08)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // Info line: highest tile and moves.
        const top = maxTile(s.board);
        pill(ctx, L.x, L.infoY, L.size, 40, null);
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(`Highest ${top}`, L.x + 16, L.infoY + 21);
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(`Move ${s.moves}`, L.x + L.size - 16, L.infoY + 21);

        // Board and empty cells.
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "#1d1830";
        ctx.beginPath();
        ctx.roundRect(L.x, L.y, L.size, L.size, 20);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        for (let i = 0; i < SIZE * SIZE; i++) {
          const p = cellXY(i);
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, L.cell, L.cell, L.cell * 0.16);
          ctx.fill();
        }

        if (anim && anim.t < SLIDE) {
          const e = 1 - Math.pow(1 - anim.t / SLIDE, 3);
          for (const m of anim.slides) {
            const a = cellXY(m.from), b = cellXY(m.to);
            tile(anim.prev[m.from], a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e);
          }
        } else {
          const p = anim ? (anim.t - SLIDE) / POP : 1;
          for (let i = 0; i < SIZE * SIZE; i++) {
            const v = s.board[i];
            if (!v) continue;
            const at = cellXY(i);
            let k = 1;
            if (anim && i === anim.spawn) k = Math.min(1, p * 1.2);
            else if (anim && anim.merges.includes(i)) k = 1 + 0.14 * Math.sin(Math.min(1, p) * Math.PI); // merged tiles pop
            if (k > 0) tile(v, at.x, at.y, k);
          }
        }

        // Undo, under your thumb.
        const u = L.undo;
        const can = !!s.undo && !s.over && s.d !== 2;
        ctx.fillStyle = press === "undo" && can ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(u.x, u.y, u.w, u.h, u.h / 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = can ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)";
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Undo", u.x + u.w / 2, u.y + u.h / 2 + 1);

        if (toast > 0) {
          const t = Math.min(1, (2.6 - toast) / 0.3, toast * 2.5); // in, hold, out
          banner(ctx, { cx: W / 2, cy: L.y + L.size / 2, w: Math.min(L.size - 24, 300), title: "2048!", detail: "Keep going for a bigger tile", hint: "", t, colors: ["#f472b6", "#a855f7"], reducedMotion });
        }
        if (s.over)
          banner(ctx, { cx: W / 2, cy: L.y + L.size / 2, w: Math.min(L.size - 24, 300), title: "No moves left", detail: `Highest tile ${top}`, hint: "", t: shown, colors: ["#ffb347", "#ff7e5f"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as T48State;
        anim = null;
        toast = 0;
        shown = 0;
        overIn = s.over ? 0.6 : -1;
        hot = 1;
      },
      destroy: off,
    };
  },
};

export default twenty48;
