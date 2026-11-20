import type { Action } from "@/engine/input";
import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { newGame, nextLevel, reached, rotate, type PipeState } from "./logic";

const SPIN = 0.14; // s per quarter turn

const pipeFlow: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: PipeState = newGame(rng);
    const spins = new Map<number, number>(); // cell → seconds since its last turn
    let pressed = -1;
    let press: "next" | null = null;
    let cursor = -1;
    let shown = 0;
    let overIn = -1;
    let hot = 1;
    let time = 0;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const top = ins.top + 10;
      const avail = stage.height - ins.bottom - 10 - top - 52 - 30;
      const size = Math.max(200, Math.min(stage.width - 28, avail, 600));
      const x = Math.round((stage.width - size) / 2);
      const y = Math.round(top + 52 + Math.max(0, (avail - size) / 2));
      return { x, y, size, cell: size / s.n, infoY: y - 52 };
    }
    const cellAt = (px: number, py: number) => {
      const c = Math.floor((px - L.x) / L.cell), r = Math.floor((py - L.y) / L.cell);
      return c >= 0 && c < s.n && r >= 0 && r < s.n ? r * s.n + c : -1;
    };

    function turnTile(cell: number) {
      const before = s.score;
      const wet = reached(s).size;
      if (!rotate(s, cell)) return;
      if (!reducedMotion) spins.set(cell, 0);
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (s.solved) {
        emit({ type: "feel", kind: "success" });
        shown = 0;
      } else if (!s.alive) {
        emit({ type: "feel", kind: "fail" });
        shown = 0;
        overIn = 1.7;
      } else emit({ type: "feel", kind: reached(s).size > wet ? "score" : "tap" }); // more water flowing: a stronger tick
    }
    function next() {
      nextLevel(s, rng);
      spins.clear();
      L = layout();
      emit({ type: "feel", kind: "tap" });
    }

    function onAction(a: Action) {
      if (s.solved) return void (a === "primary" && next());
      if (!s.alive) return;
      if (cursor < 0) return void (cursor = s.source);
      const r = Math.floor(cursor / s.n), c = cursor % s.n;
      if (a === "left") cursor = r * s.n + Math.max(0, c - 1);
      else if (a === "right") cursor = r * s.n + Math.min(s.n - 1, c + 1);
      else if (a === "up") cursor = Math.max(0, r - 1) * s.n + c;
      else if (a === "down") cursor = Math.min(s.n - 1, r + 1) * s.n + c;
      else if (a === "primary") turnTile(cursor);
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "action") return onAction(e.action);
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        cursor = -1;
        press = s.solved ? "next" : null;
        pressed = s.alive && !s.solved ? cellAt(e.x, e.y) : -1;
      } else if (e.phase === "move") {
        if (pressed >= 0 && cellAt(e.x, e.y) !== pressed) pressed = -1;
      } else {
        if (press === "next" && shown > 0.5) next();
        else if (pressed >= 0) turnTile(pressed); // turns on release; slide off to cancel
        pressed = -1;
        press = null;
      }
    });

    return {
      update(dt) {
        time += dt;
        if (spins.size) {
          for (const [k, t] of spins) {
            if (t + dt >= SPIN) spins.delete(k);
            else spins.set(k, t + dt);
          }
          hot = 1;
        }
        if (s.solved && !reducedMotion) hot = 1; // the finished network shimmers
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
        const wet = reached(s);
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, L.y + L.size / 2, 0, W / 2, L.y + L.size / 2, Math.max(W, H) * 0.75);
        glow.addColorStop(0, `rgba(33,147,176,${0.12 + 0.22 * (wet.size / (s.n * s.n))})`);
        glow.addColorStop(0.5, "rgba(109,213,237,0.06)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        pill(ctx, L.x, L.infoY, L.size, 40, null);
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(`Level ${s.level} · ${wet.size}/${s.n * s.n} flowing`, L.x + 16, L.infoY + 21);
        ctx.textAlign = "right";
        ctx.fillStyle = s.movesLeft <= 3 && s.alive && !s.solved ? "#ff8a8a" : "rgba(255,255,255,0.92)";
        ctx.fillText(`${s.movesLeft} turns left`, L.x + L.size - 16, L.infoY + 21);

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "#0f1b24";
        ctx.beginPath();
        ctx.roundRect(L.x - 8, L.y - 8, L.size + 16, L.size + 16, 20);
        ctx.fill();
        ctx.restore();

        const lw = Math.max(5, c * 0.2);
        for (let i = 0; i < s.n * s.n; i++) {
          const cx = L.x + (i % s.n) * c + c / 2, cy = L.y + Math.floor(i / s.n) * c + c / 2;
          const k = i === pressed ? 0.92 : 1;
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.beginPath();
          ctx.roundRect(cx - (c / 2 - 3) * k, cy - (c / 2 - 3) * k, (c - 6) * k, (c - 6) * k, c * 0.16);
          ctx.fill();
          const t = spins.get(i);
          const angle = t === undefined ? 0 : -(Math.PI / 2) * Math.pow(1 - t / SPIN, 3); // eases into place
          const on = wet.has(i);
          const m = s.tiles[i];
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.lineCap = "round";
          ctx.lineWidth = lw;
          if (on) {
            ctx.shadowColor = "#6dd5ed";
            ctx.shadowBlur = s.solved && !reducedMotion ? 10 + 6 * Math.sin(time * 4 + i * 0.4) : 10;
          }
          ctx.strokeStyle = on ? "#7fe3f5" : "#3e5566";
          ctx.beginPath();
          for (const [bit, dx, dy] of [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]]) {
            if (!(m & bit)) continue;
            ctx.moveTo(0, 0);
            ctx.lineTo((dx * c) / 2, (dy * c) / 2);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          const ends = [1, 2, 4, 8].filter((b) => m & b).length;
          if (i === s.source) {
            // The source: a bright core.
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, c * 0.3);
            g.addColorStop(0, "#ffffff");
            g.addColorStop(0.5, "#6dd5ed");
            g.addColorStop(1, "#2193b0");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, c * 0.26, 0, Math.PI * 2);
            ctx.fill();
          } else if (ends === 1) {
            // An endpoint: a lamp that lights when water arrives.
            ctx.fillStyle = on ? "#b2fefa" : "#24323d";
            ctx.strokeStyle = on ? "#7fe3f5" : "#3e5566";
            ctx.lineWidth = Math.max(2, c * 0.05);
            ctx.beginPath();
            ctx.arc(0, 0, c * 0.17, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillStyle = on ? "#7fe3f5" : "#3e5566";
            ctx.beginPath();
            ctx.arc(0, 0, lw / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          if (i === cursor) {
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(cx - c / 2 + 2, cy - c / 2 + 2, c - 4, c - 4, c * 0.18);
            ctx.stroke();
          }
        }

        if (s.solved)
          banner(ctx, { cx: W / 2, cy: L.y + L.size / 2, w: Math.min(L.size - 16, 300), title: "It flows", detail: `+${60 * s.level + 15 * s.movesLeft}`, hint: `Tap for level ${s.level + 1}`, t: shown, colors: ["#b2fefa", "#6dd5ed"], reducedMotion });
        else if (!s.alive)
          banner(ctx, { cx: W / 2, cy: L.y + L.size / 2, w: Math.min(L.size - 16, 300), title: "Out of turns", detail: `${s.n * s.n - wet.size} tiles still dry`, hint: "", t: shown, colors: ["#ffb199", "#ff6e7f"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as PipeState;
        spins.clear();
        pressed = -1;
        shown = 0;
        overIn = s.alive ? -1 : 0.6;
        hot = 1;
      },
      destroy: off,
    };
  },
};

export default pipeFlow;
