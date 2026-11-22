import { fitWorld } from "@/engine/stage";
import type { GameModule } from "@/engine/types";
import {
  BALL_R, H, PADDLE_H, PADDLE_Y, W, brickRect, launch, movePaddle, newGame, paddleW, step, type Brick, type BrickState, type Power,
} from "./logic";

const HP: Record<number, [string, string]> = {
  1: ["#5eead4", "#0ea5e9"],
  2: ["#f0abfc", "#8b5cf6"],
  3: ["#fde68a", "#f97316"],
};
const POWER: Record<Power, { c: string; t: string }> = {
  wide: { c: "#38bdf8", t: "W" },
  multi: { c: "#f472b6", t: "3" },
  slow: { c: "#a3e635", t: "S" },
  life: { c: "#fb7185", t: "♥" },
};
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: string;
}

const brickline: GameModule = {
  kind: "2d",
  create({ difficulty, stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: BrickState = newGame(rng, 0, difficulty);
    let sparks: Spark[] = [];
    let trail: { x: number; y: number }[] = [];
    let F = fitWorld(stage, insets(), W, H);
    let drag: { p0: number } | null = null;

    const off = input.on((e) => {
      if (e.type === "tap" || (e.type === "action" && (e.action === "primary" || e.action === "up"))) launch(s);
      else if (e.type === "drag") {
        if (e.phase === "start") drag = { p0: s.paddle };
        else if (e.phase === "move" && drag) movePaddle(s, drag.p0 + e.dx / F.k); // keeps the grab offset
        else if (e.phase === "end") drag = null;
      }
    });

    return {
      update(dt) {
        const keyDir = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
        if (keyDir) movePaddle(s, s.paddle + keyDir * 120 * dt);
        const before = new Map(s.bricks.map((b) => [`${b.c},${b.r}`, b.hp]));
        const score = s.score;
        const ev = step(s, dt, rng);
        if (!reducedMotion) {
          const now = new Set(s.bricks.map((b) => `${b.c},${b.r}`));
          for (const [key, hp] of before)
            if (!now.has(key) && !ev.includes("level")) {
              const [c, r] = key.split(",").map(Number);
              const R = brickRect({ c, r, hp } as Brick);
              for (let i = 0; i < 10; i++)
                sparks.push({
                  x: R.x + R.w / 2, y: R.y + R.h / 2, vx: (rng.next() - 0.5) * 60, vy: (rng.next() - 0.7) * 50,
                  life: 0.5 + rng.next() * 0.3, c: HP[Math.min(3, hp)][0],
                });
            }
        }
        sparks = sparks.map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + 90 * dt, life: p.life - dt })).filter((p) => p.life > 0);
        const b = s.balls[0];
        if (b && !s.stuck) trail = [{ x: b.x, y: b.y }, ...trail].slice(0, 8);
        else trail = [];

        if (s.score !== score) emit({ type: "score", value: s.score });
        if (ev.includes("dead")) {
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.score });
        } else if (ev.includes("level") || ev.includes("power")) emit({ type: "feel", kind: "success" });
        else if (ev.includes("lost")) emit({ type: "feel", kind: "fail" });
        else if (ev.includes("break")) emit({ type: "feel", kind: "score" });
        else if (ev.includes("paddle")) emit({ type: "feel", kind: "tap" });
      },

      render() {
        F = fitWorld(stage, insets(), W, H);
        const { k } = F;
        const X = (x: number) => F.x + x * k;
        const Y = (y: number) => F.y + y * k;
        ctx.clearRect(0, 0, stage.width, stage.height);

        const glow = ctx.createRadialGradient(stage.width / 2, Y(30), 0, stage.width / 2, Y(30), stage.height * 0.8);
        glow.addColorStop(0, "rgba(245,175,25,0.20)");
        glow.addColorStop(0.5, "rgba(241,39,17,0.10)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, stage.width, stage.height);

        // Arena.
        ctx.fillStyle = "rgba(12,10,20,0.7)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(X(0) - 4, Y(0) - 4, W * k + 8, H * k + 8, 18);
        ctx.fill();
        ctx.stroke();

        // Lives + level.
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.textAlign = "left";
        ctx.fillText(`LEVEL ${s.level + 1}`, X(3), Y(8));
        for (let i = 0; i < s.lives; i++) {
          ctx.fillStyle = "#fb7185";
          ctx.beginPath();
          ctx.arc(X(W - 4 - i * 4.5), Y(6.5), 1.4 * k, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bricks.
        for (const b of s.bricks) {
          const r = brickRect(b);
          const [c0, c1] = HP[Math.min(3, b.hp)];
          const g = ctx.createLinearGradient(X(r.x), Y(r.y), X(r.x + r.w), Y(r.y + r.h));
          g.addColorStop(0, c0);
          g.addColorStop(1, c1);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(X(r.x) + 1.5, Y(r.y) + 1, r.w * k - 3, r.h * k - 2, Math.min(6, r.h * k * 0.3));
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.fillRect(X(r.x) + 4, Y(r.y) + 2.5, r.w * k - 8, Math.max(1.5, r.h * k * 0.18));
        }

        // Drops.
        for (const d of s.drops) {
          const p = POWER[d.kind];
          ctx.save();
          ctx.shadowColor = p.c;
          ctx.shadowBlur = 12;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.roundRect(X(d.x - 4), Y(d.y - 1.8), 8 * k, 3.6 * k, 3.6 * k);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = "#0b0b14";
          ctx.font = `800 ${Math.round(2.8 * k)}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.t, X(d.x), Y(d.y) + 0.5);
          ctx.textBaseline = "alphabetic";
        }

        // Paddle.
        const pw = paddleW(s);
        const pg = ctx.createLinearGradient(X(s.paddle - pw / 2), 0, X(s.paddle + pw / 2), 0);
        pg.addColorStop(0, "#f12711");
        pg.addColorStop(0.5, "#f5af19");
        pg.addColorStop(1, "#ffe259");
        ctx.save();
        ctx.shadowColor = "#f5af19";
        ctx.shadowBlur = 18;
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.roundRect(X(s.paddle - pw / 2), Y(PADDLE_Y), pw * k, PADDLE_H * k, PADDLE_H * k);
        ctx.fill();
        ctx.restore();

        // Ball trail + balls.
        trail.forEach((t, i) => {
          ctx.globalAlpha = (1 - i / trail.length) * 0.25;
          ctx.fillStyle = s.slow > 0 ? "#a3e635" : "#fff";
          ctx.beginPath();
          ctx.arc(X(t.x), Y(t.y), BALL_R * k * (1 - i / 12), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        for (const b of s.balls) {
          ctx.save();
          ctx.shadowColor = "#fff";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(X(b.x), Y(b.y), BALL_R * k, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        for (const p of sparks) {
          ctx.globalAlpha = Math.min(1, p.life * 2);
          ctx.fillStyle = p.c;
          ctx.fillRect(X(p.x) - 1.5, Y(p.y) - 1.5, 3, 3);
        }
        ctx.globalAlpha = 1;

        if (s.stuck && s.alive) {
          ctx.font = "600 14px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fillText("Drag to aim · Tap to launch", X(W / 2), Y(PADDLE_Y - 14));
        }
      },

      serialize: () => s,
      restore(data) {
        s = data as BrickState;
        sparks = [];
        trail = [];
      },
      destroy: off,
    };
  },
};

export default brickline;
