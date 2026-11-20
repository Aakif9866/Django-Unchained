import { fitWorld } from "@/engine/stage";
import type { GameModule } from "@/engine/types";
import { H, ROCK_R, SHIP_R, W, newGame, step, type OrbitState } from "./logic";

const ROCK_C = ["", "#2ebf91", "#8360c3", "#f472b6"];
const hash = (n: number) => {
  const s = Math.sin(n * 91.7) * 43758.5453;
  return s - Math.floor(s);
};
const STICK = 60; // px of drag for full thrust

const orbit: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: OrbitState = newGame(rng);
    let stick: { x0: number; y0: number; x: number; y: number } | null = null;
    let booms: { x: number; y: number; t: number; c: string; r: number }[] = [];
    let F = fitWorld(stage, insets(), W, H);

    const off = input.on((e) => {
      if (e.type !== "drag") return;
      if (e.phase === "start") stick = { x0: e.x, y0: e.y, x: e.x, y: e.y };
      else if (e.phase === "move" && stick) {
        stick.x = e.x;
        stick.y = e.y;
        const len = Math.hypot(e.dx, e.dy);
        if (len > 8) {
          s.ctl.aim = Math.atan2(e.dy, e.dx);
          s.ctl.thrust = Math.min(1, len / STICK);
        }
      } else if (e.phase === "end") {
        stick = null;
        s.ctl.thrust = 0;
      }
    });

    return {
      update(dt) {
        if (!stick) {
          const turn = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
          const thrust = input.isDown("up") ? 1 : 0;
          if (turn || thrust) s.ctl.aim = null;
          s.ctl.turn = turn;
          s.ctl.thrust = thrust;
        }
        const before = s.rocks.map((r) => ({ x: r.x, y: r.y, size: r.size, seed: r.seed }));
        const score = s.score;
        const ev = step(s, dt, rng);
        if (!reducedMotion && (ev.includes("split") || ev.includes("hit"))) {
          for (const r of before)
            if (!s.rocks.some((n) => n.seed === r.seed)) booms.push({ x: r.x, y: r.y, t: 0.4, c: ROCK_C[r.size], r: ROCK_R[r.size] });
        }
        if (!reducedMotion && (ev.includes("crash") || ev.includes("dead"))) booms.push({ x: s.ship.x, y: s.ship.y, t: 0.6, c: "#fff", r: 10 });
        booms = booms.map((b) => ({ ...b, t: b.t - dt })).filter((b) => b.t > 0);
        if (s.score !== score) emit({ type: "score", value: s.score });
        if (ev.includes("dead")) {
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.score });
        } else if (ev.includes("crash")) emit({ type: "feel", kind: "fail" });
        else if (ev.includes("wave")) emit({ type: "feel", kind: "success" });
        else if (ev.includes("split") || ev.includes("hit")) emit({ type: "feel", kind: "score" });
      },

      render() {
        F = fitWorld(stage, insets(), W, H);
        const { k } = F;
        const SW = stage.width;
        const SH = stage.height;
        ctx.clearRect(0, 0, SW, SH);

        // Nebula.
        const n1 = ctx.createRadialGradient(SW * 0.2, SH * 0.3, 0, SW * 0.2, SH * 0.3, SH * 0.6);
        n1.addColorStop(0, "rgba(131,96,195,0.30)");
        n1.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = n1;
        ctx.fillRect(0, 0, SW, SH);
        const n2 = ctx.createRadialGradient(SW * 0.85, SH * 0.75, 0, SW * 0.85, SH * 0.75, SH * 0.5);
        n2.addColorStop(0, "rgba(46,191,145,0.22)");
        n2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = n2;
        ctx.fillRect(0, 0, SW, SH);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(F.x, F.y, W * k, H * k, 18);
        ctx.fillStyle = "rgba(6,6,18,0.55)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.stroke();
        ctx.clip();
        for (let i = 0; i < 70; i++) {
          ctx.globalAlpha = 0.2 + hash(i + 3) * 0.6;
          ctx.fillStyle = "#fff";
          ctx.fillRect(F.x + hash(i) * W * k, F.y + hash(i + 0.5) * H * k, 1.4, 1.4);
        }
        ctx.globalAlpha = 1;

        /** Draw at the position and, near an edge, at its wrapped twins. */
        const each = (x: number, y: number, r: number, draw: (sx: number, sy: number) => void) => {
          for (const ox of [-W, 0, W])
            for (const oy of [-H, 0, H]) {
              const wx = x + ox;
              const wy = y + oy;
              if (wx < -r || wx > W + r || wy < -r || wy > H + r) continue;
              draw(F.x + wx * k, F.y + wy * k);
            }
        };

        for (const r of s.rocks) {
          const rad = ROCK_R[r.size] * k;
          each(r.x, r.y, ROCK_R[r.size], (sx, sy) => {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(r.a);
            ctx.beginPath();
            const n = 9 + r.size;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              const rr = rad * (0.78 + hash(r.seed + i) * 0.3);
              if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
              else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            ctx.closePath();
            const g = ctx.createRadialGradient(-rad * 0.3, -rad * 0.3, 0, 0, 0, rad);
            g.addColorStop(0, "rgba(255,255,255,0.14)");
            g.addColorStop(1, "rgba(20,14,40,0.9)");
            ctx.fillStyle = g;
            ctx.fill();
            ctx.shadowColor = ROCK_C[r.size];
            ctx.shadowBlur = 12;
            ctx.strokeStyle = ROCK_C[r.size];
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.restore();
          });
        }

        ctx.fillStyle = "#fff8c4";
        for (const b of s.bullets)
          each(b.x, b.y, 1, (sx, sy) => {
            ctx.save();
            ctx.shadowColor = "#ffd166";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(sx, sy, 0.9 * k, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });

        const sh = s.ship;
        const blink = sh.inv > 0 && !reducedMotion && Math.floor(sh.inv * 8) % 2 === 0;
        if (s.alive && !blink)
          each(sh.x, sh.y, SHIP_R * 2, (sx, sy) => {
            const r = SHIP_R * k * 1.4;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(sh.a);
            if (s.ctl.thrust > 0.05) {
              const fl = ctx.createLinearGradient(-r, 0, -r * (2 + s.ctl.thrust * 2), 0);
              fl.addColorStop(0, "#ffd166");
              fl.addColorStop(1, "rgba(255,80,120,0)");
              ctx.fillStyle = fl;
              ctx.beginPath();
              ctx.moveTo(-r * 0.7, -r * 0.45);
              ctx.lineTo(-r * (1.8 + s.ctl.thrust * 1.8 + (reducedMotion ? 0 : Math.random() * 0.5)), 0);
              ctx.lineTo(-r * 0.7, r * 0.45);
              ctx.fill();
            }
            const g = ctx.createLinearGradient(-r, 0, r * 1.4, 0);
            g.addColorStop(0, "#8360c3");
            g.addColorStop(1, "#2ebf91");
            ctx.shadowColor = "#2ebf91";
            ctx.shadowBlur = 14;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(r * 1.5, 0);
            ctx.lineTo(-r, -r);
            ctx.lineTo(-r * 0.55, 0);
            ctx.lineTo(-r, r);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.8)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
          });

        for (const b of booms) {
          const life = b.t / 0.5;
          ctx.globalAlpha = Math.min(1, life);
          ctx.strokeStyle = b.c;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(F.x + b.x * k, F.y + b.y * k, b.r * k * (1.6 - life), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        ctx.font = "600 11px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "left";
        ctx.fillText(`WAVE ${s.wave}`, F.x + 12, F.y + 20);
        for (let i = 0; i < s.lives; i++) {
          ctx.save();
          ctx.translate(F.x + W * k - 16 - i * 16, F.y + 16);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = "#2ebf91";
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(-4, -4);
          ctx.lineTo(-4, 4);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();

        // Thumb stick: where the finger went down, and where it is now.
        if (stick) {
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(stick.x0, stick.y0, STICK, 0, Math.PI * 2);
          ctx.stroke();
          const dx = stick.x - stick.x0;
          const dy = stick.y - stick.y0;
          const len = Math.min(STICK, Math.hypot(dx, dy)) / (Math.hypot(dx, dy) || 1);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath();
          ctx.arc(stick.x0 + dx * len, stick.y0 + dy * len, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      },

      serialize: () => s,
      restore(data) {
        s = data as OrbitState;
        s.ctl = { aim: s.ctl.aim, turn: 0, thrust: 0 };
        booms = [];
      },
      destroy: off,
    };
  },
};

export default orbit;
