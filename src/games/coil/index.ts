import type { GameModule } from "@/engine/types";
import { boardFor, newGame, tick, tickMs, turn, type CoilState, type P } from "./logic";

const BODY = ["#34e89e", "#0fb8ad", "#1f6feb"]; // head → tail
const FOOD = "#ff5f8f";
const BONUS = "#ffd166";

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
const bodyColor = (t: number) => (t < 0.5 ? mix(BODY[0], BODY[1], t * 2) : mix(BODY[1], BODY[2], (t - 0.5) * 2));

const coil: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    const board = boardFor(stage.width, stage.height);
    let s: CoilState = newGame(board.w, board.h, rng);
    let acc = 0; // ms into the current tick
    let clock = 0; // seconds, for idle animation only
    let deathFlash = 0;

    const off = input.on((e) => {
      if (e.type === "swipe") turn(s, e.dir);
      else if (e.type === "action" && e.action !== "primary" && e.action !== "pause") turn(s, e.action);
    });

    function layout() {
      const ins = insets();
      const pad = 16;
      const availW = stage.width - pad * 2;
      const availH = stage.height - ins.top - ins.bottom - pad * 2;
      const cell = Math.max(4, Math.floor(Math.min(availW / s.w, availH / s.h)));
      const bw = cell * s.w;
      const bh = cell * s.h;
      return { cell, x: Math.round((stage.width - bw) / 2), y: Math.round(ins.top + pad + (availH - bh) / 2), bw, bh };
    }

    return {
      update(dt) {
        clock += dt;
        if (deathFlash > 0) deathFlash = Math.max(0, deathFlash - dt);
        if (!s.alive) return;
        acc += dt * 1000;
        const ms = tickMs(s.eaten);
        while (acc >= ms && s.alive) {
          acc -= ms;
          const r = tick(s, rng);
          if (r === "eat" || r === "bonus") {
            emit({ type: "score", value: s.score });
            emit({ type: "feel", kind: r === "bonus" ? "success" : "score" });
          } else if (r === "dead") {
            deathFlash = 0.6;
            emit({ type: "feel", kind: "fail" });
            emit({ type: "over", score: s.score });
          }
        }
      },

      render() {
        const L = layout();
        const { cell } = L;
        ctx.clearRect(0, 0, stage.width, stage.height);

        // Board: a lifted surface with a quiet dot grid.
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.035)";
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(L.x - 6, L.y - 6, L.bw + 12, L.bh + 12, 18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        for (let y = 0; y < s.h; y++)
          for (let x = 0; x < s.w; x++) ctx.fillRect(L.x + x * cell + cell / 2 - 1, L.y + y * cell + cell / 2 - 1, 2, 2);
        ctx.restore();

        const px = (p: P) => ({ x: L.x + p.x * cell + cell / 2, y: L.y + p.y * cell + cell / 2 });
        const pulse = reducedMotion ? 1 : 1 + Math.sin(clock * 5) * 0.08;

        // Food and bonus glow.
        const dot = (p: P, color: string, r: number) => {
          const c = px(p);
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = cell * 0.9;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };
        dot(s.food, FOOD, cell * 0.3 * pulse);
        if (s.bonus) {
          ctx.globalAlpha = s.bonusTtl < 8 ? 0.4 + 0.6 * Math.abs(Math.sin(clock * 10)) : 1;
          dot(s.bonus, BONUS, cell * 0.38 * pulse);
          ctx.globalAlpha = 1;
        }

        // Snake: interpolated between the last two ticks so motion is continuous, not steppy.
        const t = s.alive ? Math.min(1, acc / tickMs(s.eaten)) : 1;
        const pts = s.snake.map((p, i) => {
          const a = px(s.prev[i] ?? p);
          const b = px(p);
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        });
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = cell * 0.72;
        for (let i = pts.length - 1; i > 0; i--) {
          ctx.strokeStyle = bodyColor(i / Math.max(1, pts.length - 1));
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
          ctx.stroke();
        }
        const h = pts[0];
        ctx.save();
        ctx.shadowColor = BODY[0];
        ctx.shadowBlur = cell * 0.8;
        ctx.fillStyle = s.alive ? BODY[0] : "#ff5f6d";
        ctx.beginPath();
        ctx.arc(h.x, h.y, cell * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Eyes look where we're heading.
        const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[s.dir];
        ctx.fillStyle = "#06120e";
        for (const side of [-1, 1]) {
          const ex = h.x + v[0] * cell * 0.14 + -v[1] * side * cell * 0.17;
          const ey = h.y + v[1] * cell * 0.14 + v[0] * side * cell * 0.17;
          ctx.beginPath();
          ctx.arc(ex, ey, cell * 0.07, 0, Math.PI * 2);
          ctx.fill();
        }

        if (deathFlash > 0 && !reducedMotion) {
          ctx.fillStyle = `rgba(255,80,100,${deathFlash * 0.25})`;
          ctx.fillRect(0, 0, stage.width, stage.height);
        }
      },

      serialize: () => ({ s, acc }),
      restore(data) {
        const d = data as { s: CoilState; acc: number };
        s = d.s;
        acc = d.acc;
      },
      destroy: off,
    };
  },
};

export default coil;
