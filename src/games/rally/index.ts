import { fitWorld } from "@/engine/stage";
import type { GameModule } from "@/engine/types";
import { BALL_R, CPU_Y, H, PADDLE_H, PADDLE_W, TO_WIN, W, YOU_Y, moveYou, newGame, step, type RallyState } from "./logic";

const YOU = ["#00f5d4", "#00bbf9"];
const CPU = ["#f15bb5", "#9b5de5"];

const rally: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: RallyState = newGame(rng);
    let F = fitWorld(stage, insets(), W, H);
    let drag: { p0: number } | null = null;
    let trail: { x: number; y: number }[] = [];
    let flash = 0;

    const off = input.on((e) => {
      if (e.type !== "drag") return;
      if (e.phase === "start") drag = { p0: s.you };
      else if (e.phase === "move" && drag) moveYou(s, drag.p0 + e.dx / F.k);
      else drag = null;
    });

    function paddle(x: number, y: number, c: string[]) {
      const g = ctx.createLinearGradient(F.x + (x - PADDLE_W / 2) * F.k, 0, F.x + (x + PADDLE_W / 2) * F.k, 0);
      g.addColorStop(0, c[0]);
      g.addColorStop(1, c[1]);
      ctx.save();
      ctx.shadowColor = c[0];
      ctx.shadowBlur = 18;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(F.x + (x - PADDLE_W / 2) * F.k, F.y + y * F.k, PADDLE_W * F.k, PADDLE_H * F.k, PADDLE_H * F.k);
      ctx.fill();
      ctx.restore();
    }

    return {
      update(dt) {
        const dir = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
        if (dir) moveYou(s, s.you + dir * 110 * dt);
        flash = Math.max(0, flash - dt * 2);
        const score = s.score;
        const ev = step(s, dt, rng);
        trail = s.serve > 0 ? [] : [{ x: s.ball.x, y: s.ball.y }, ...trail].slice(0, 10);
        if (s.score !== score) emit({ type: "score", value: s.score });
        if (ev.includes("dead")) {
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.score });
        } else if (ev.includes("match")) {
          flash = 1;
          emit({ type: "feel", kind: "success" });
        } else if (ev.includes("point-you")) emit({ type: "feel", kind: "score" });
        else if (ev.includes("point-cpu")) emit({ type: "feel", kind: "fail" });
        else if (ev.includes("hit")) emit({ type: "feel", kind: "tap" });
      },

      render() {
        F = fitWorld(stage, insets(), W, H);
        const { k } = F;
        const X = (x: number) => F.x + x * k;
        const Y = (y: number) => F.y + y * k;
        ctx.clearRect(0, 0, stage.width, stage.height);

        const top = ctx.createRadialGradient(stage.width / 2, Y(0), 0, stage.width / 2, Y(0), stage.height * 0.6);
        top.addColorStop(0, "rgba(155,93,229,0.28)");
        top.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = top;
        ctx.fillRect(0, 0, stage.width, stage.height);
        const bot = ctx.createRadialGradient(stage.width / 2, Y(H), 0, stage.width / 2, Y(H), stage.height * 0.6);
        bot.addColorStop(0, "rgba(0,187,249,0.25)");
        bot.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = bot;
        ctx.fillRect(0, 0, stage.width, stage.height);

        ctx.save();
        ctx.fillStyle = "rgba(8,8,20,0.6)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(X(0) - 4, Y(0) - 4, W * k + 8, H * k + 8, 18);
        ctx.fill();
        ctx.stroke();
        ctx.clip();

        // Court: centre line + big ghosted scores.
        ctx.setLineDash([8, 10]);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(X(0), Y(H / 2));
        ctx.lineTo(X(W), Y(H / 2));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = "center";
        ctx.font = `800 ${Math.round(18 * k)}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(241,91,181,0.16)";
        ctx.fillText(String(s.pts.cpu), X(W / 2), Y(H / 2 - 12));
        ctx.fillStyle = "rgba(0,245,212,0.16)";
        ctx.fillText(String(s.pts.you), X(W / 2), Y(H / 2 + 12 + 13));
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.textAlign = "left";
        ctx.fillText(`MATCH ${s.level + 1} · FIRST TO ${TO_WIN}`, X(3), Y(H / 2) - 8);

        paddle(s.cpu, CPU_Y, CPU);
        paddle(s.you, YOU_Y, YOU);

        trail.forEach((t, i) => {
          ctx.globalAlpha = (1 - i / trail.length) * 0.3;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(X(t.x), Y(t.y), BALL_R * k * (1 - i / 14), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        if (s.serve <= 0 || reducedMotion || Math.floor(s.serve * 6) % 2 === 0) {
          ctx.save();
          ctx.shadowColor = "#fff";
          ctx.shadowBlur = 16;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(X(s.ball.x), Y(s.ball.y), BALL_R * k, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (flash > 0 && !reducedMotion) {
          ctx.fillStyle = `rgba(0,245,212,${flash * 0.18})`;
          ctx.fillRect(X(0), Y(0), W * k, H * k);
        }
        ctx.restore();
      },

      serialize: () => s,
      restore(data) {
        s = data as RallyState;
        trail = [];
      },
      destroy: off,
    };
  },
};

export default rally;
