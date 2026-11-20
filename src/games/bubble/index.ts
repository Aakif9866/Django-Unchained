import { fitWorld } from "@/engine/stage";
import type { GameModule } from "@/engine/types";
import {
  D, DEAD_ROW, H, MISSES_PER_ROW, R, ROW_H, SHOOTER, TOP, W, center, fire, newGame, parse, setAim, step, swap, type BubbleState, type Landed,
} from "./logic";

const PAL: [string, string][] = [
  ["#ff9ab8", "#e11d74"],
  ["#7ee7f7", "#0891b2"],
  ["#d9f99d", "#65a30d"],
  ["#fde68a", "#d97706"],
  ["#ddd6fe", "#7c3aed"],
];
interface Fx {
  x: number;
  y: number;
  vy: number;
  color: number;
  t: number;
  kind: "pop" | "fall";
}

const bubble: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: BubbleState = newGame(rng);
    let fx: Fx[] = [];
    let F = fitWorld(stage, insets(), W, H);
    let aiming = false;
    const toWorld = (x: number, y: number) => ({ x: (x - F.x) / F.k, y: (y - F.y) / F.k });
    const aimAt = (x: number, y: number) => {
      const p = toWorld(x, y);
      setAim(s, Math.atan2(p.y - SHOOTER.y, p.x - SHOOTER.x));
    };
    const nearShooter = (x: number, y: number) => {
      const p = toWorld(x, y);
      return Math.hypot(p.x - SHOOTER.x, p.y - SHOOTER.y) < 9;
    };
    const shoot = () => {
      if (fire(s)) emit({ type: "feel", kind: "tap" });
    };

    const off = input.on((e) => {
      if (e.type === "drag") {
        if (e.phase === "start") {
          aiming = !nearShooter(e.x, e.y);
          if (aiming) aimAt(e.x, e.y);
        } else if (e.phase === "move" && aiming) aimAt(e.x, e.y);
        else if (e.phase === "end" && aiming && Math.hypot(e.dx, e.dy) > 10) {
          aiming = false;
          shoot(); // release to fire after a drag
        }
      } else if (e.type === "tap") {
        aiming = false;
        if (nearShooter(e.x, e.y)) swap(s);
        else {
          aimAt(e.x, e.y);
          shoot();
        }
      } else if (e.type === "action") {
        if (e.action === "primary" || e.action === "up") shoot();
        else if (e.action === "secondary" || e.action === "down") swap(s);
      }
    });

    const land = (res: Landed) => {
      for (const p of res.popped) {
        const c = center(s, p.r, p.c);
        fx.push({ ...c, vy: 0, color: p.color, t: 0.3, kind: "pop" });
      }
      for (const p of res.dropped) {
        const c = center(s, p.r, p.c);
        fx.push({ ...c, vy: -20 - rng.next() * 30, color: p.color, t: 1.2, kind: "fall" });
      }
      emit({ type: "score", value: s.score });
      if (!s.alive) {
        emit({ type: "feel", kind: "fail" });
        emit({ type: "over", score: s.score });
      } else if (res.cleared || res.dropped.length) emit({ type: "feel", kind: "success" });
      else if (res.popped.length) emit({ type: "feel", kind: "score" });
    };

    function ball(x: number, y: number, color: number, scale = 1, alpha = 1) {
      const [a, b] = PAL[color];
      const r = R * F.k * 0.94 * scale;
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.25, a);
      g.addColorStop(1, b);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    /** Aim guide: trace the path with wall bounces until it would touch the ceiling or a bubble. */
    function guide() {
      let x = SHOOTER.x;
      let y = SHOOTER.y;
      let vx = Math.cos(s.aim);
      const vy = Math.sin(s.aim);
      const pts: { x: number; y: number }[] = [];
      const cells = Object.keys(s.grid).map((k) => center(s, ...parse(k)));
      for (let i = 0; i < 400; i++) {
        x += vx * 1.2;
        y += vy * 1.2;
        if (x < R || x > W - R) {
          vx = -vx;
          x = Math.max(R, Math.min(W - R, x));
        }
        if (i % 5 === 0) pts.push({ x, y });
        if (y <= TOP + R || cells.some((c) => (c.x - x) ** 2 + (c.y - y) ** 2 < (D * 0.85) ** 2)) break;
      }
      return pts;
    }

    return {
      update(dt) {
        const turn = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
        if (turn) setAim(s, s.aim + turn * 1.6 * dt);
        fx = fx
          .map((f) => (f.kind === "fall" ? { ...f, y: f.y + f.vy * dt, vy: f.vy + 260 * dt, t: f.t - dt } : { ...f, t: f.t - dt }))
          .filter((f) => f.t > 0);
        const res = step(s, dt, rng);
        if (res) land(res);
      },

      render() {
        F = fitWorld(stage, insets(), W, H);
        const { k } = F;
        const X = (x: number) => F.x + x * k;
        const Y = (y: number) => F.y + y * k;
        ctx.clearRect(0, 0, stage.width, stage.height);

        const bg = ctx.createRadialGradient(stage.width / 2, Y(H), 0, stage.width / 2, Y(H), stage.height);
        bg.addColorStop(0, "rgba(124,58,237,0.30)");
        bg.addColorStop(0.5, "rgba(225,29,116,0.12)");
        bg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, stage.width, stage.height);

        ctx.save();
        ctx.fillStyle = "rgba(10,8,24,0.65)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(X(0) - 4, Y(0) - 4, W * k + 8, H * k + 8, 18);
        ctx.fill();
        ctx.stroke();
        ctx.clip();

        // Danger line.
        const dy = Y(TOP + DEAD_ROW * ROW_H);
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = "rgba(255,95,143,0.45)";
        ctx.beginPath();
        ctx.moveTo(X(0), dy);
        ctx.lineTo(X(W), dy);
        ctx.stroke();
        ctx.setLineDash([]);

        for (const [kk, color] of Object.entries(s.grid)) {
          const c = center(s, ...parse(kk));
          ball(X(c.x), Y(c.y), color);
        }

        if (!s.shot && s.alive) {
          ctx.fillStyle = PAL[s.cur][0];
          for (const [i, p] of guide().entries()) {
            ctx.globalAlpha = Math.max(0.1, 0.8 - i * 0.012);
            ctx.beginPath();
            ctx.arc(X(p.x), Y(p.y), 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        for (const f of fx) {
          if (f.kind === "pop") ball(X(f.x), Y(f.y), f.color, reducedMotion ? 1 : 1 + (0.3 - f.t) * 2, f.t / 0.3);
          else ball(X(f.x), Y(f.y), f.color, 1, Math.min(1, f.t));
        }

        if (s.shot) ball(X(s.shot.x), Y(s.shot.y), s.shot.color);

        // Shooter: current bubble on a glowing base, next one beside it.
        ctx.save();
        ctx.shadowColor = PAL[s.cur][1];
        ctx.shadowBlur = 24;
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X(SHOOTER.x), Y(SHOOTER.y), R * k * 1.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (!s.shot) ball(X(SHOOTER.x), Y(SHOOTER.y), s.cur);
        ball(X(SHOOTER.x + 16), Y(SHOOTER.y + 3), s.next, 0.7);
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillText("NEXT", X(SHOOTER.x + 16), Y(SHOOTER.y + 3) + R * k + 6);
        // Misses until the ceiling drops.
        for (let i = 0; i < MISSES_PER_ROW; i++) {
          ctx.fillStyle = i < MISSES_PER_ROW - s.misses ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)";
          ctx.beginPath();
          ctx.arc(X(8 + i * 4), Y(SHOOTER.y + 3), 1.3 * k * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      serialize: () => s,
      restore(data) {
        s = data as BubbleState;
        fx = [];
      },
      destroy: off,
    };
  },
};

export default bubble;
