import { createRng } from "@/engine/rng";
import type { GameModule } from "@/engine/types";
import { banner, createThinker, dots, pill } from "../kit";
import { COLS, ROWS, drop, heightOf, newGame, nextGame, think, tier, type Color, type FourState } from "./logic";

const YOU: [string, string] = ["#ff7a45", "#e11d74"];
const CPU: [string, string] = ["#fde68a", "#f59e0b"];
const GRAVITY = 70; // cells / s²

const fourUp: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: FourState = newGame();
    const ai = createThinker<{ grid: number[]; turn: Color; level: number; seed: number }>(
      () => new Worker(new URL("./ai.worker.ts", import.meta.url)),
      (q) => think(q.grid, q.turn, q.level, createRng(q.seed), () => performance.now()).move,
    );

    // View state: never saved, rebuilt from `s`.
    let aim = 3;
    let pressing = false;
    let falls: { cell: number; y: number; vy: number; target: number; v: number; hit: boolean }[] = [];
    let shown = 0; // result banner, 0 → 1 (waits for the last disc to land)
    let settled = false;
    let overIn = -1;
    let press = false;
    let hot = 1;
    let time = 0;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const strip = 40, gap = 10;
      const top = ins.top + 6;
      const availH = stage.height - ins.bottom - 6 - top - 2 * (strip + gap);
      const cell = Math.max(24, Math.floor(Math.min((stage.width - 28) / COLS, availH / (ROWS + 1.15), 96)));
      const bw = cell * COLS, bh = cell * ROWS;
      const x = Math.round((stage.width - bw) / 2);
      const zoneY = Math.round(top + strip + gap + Math.max(0, (availH - bh - cell * 1.15) / 2));
      const y = zoneY + Math.round(cell * 1.15);
      return { x, y, cell, bw, bh, zoneY, strip, topY: zoneY - gap - strip, botY: y + bh + 14 };
    }
    const colX = (c: number) => L.x + c * L.cell + L.cell / 2;
    const rowY = (screenRow: number) => L.y + screenRow * L.cell + L.cell / 2; // screen row 0 = top
    const colAt = (x: number) => Math.max(0, Math.min(COLS - 1, Math.floor((x - L.x) / L.cell)));
    const yourTurn = () => !s.result && s.turn === s.you;

    function play(col: number) {
      const v = s.turn;
      const before = s.score;
      const cell = drop(s, col);
      if (cell < 0) return;
      if (reducedMotion) emit({ type: "feel", kind: "tap" });
      else falls.push({ cell, y: -1.15, vy: 0, target: ROWS - 1 - Math.floor(cell / COLS), v, hit: false });
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (s.result) {
        shown = 0;
        settled = false;
      }
      hot = 1;
    }

    function next() {
      nextGame(s);
      falls = [];
      aim = 3;
      emit({ type: "feel", kind: "tap" });
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "drag") {
        const over = e.x >= L.x - 10 && e.x <= L.x + L.bw + 10 && e.y >= L.zoneY - 10 && e.y <= L.y + L.bh + 10;
        if (e.phase === "start") {
          press = !!s.result && s.result.kind !== "loss";
          pressing = over && yourTurn();
          if (pressing) aim = colAt(e.x);
        } else if (e.phase === "move") {
          if (pressing) aim = colAt(e.x);
        } else {
          if (press && shown > 0.5) next();
          else if (pressing && yourTurn()) play(aim); // the disc follows your finger; it drops on release
          pressing = press = false;
        }
      } else if (e.type === "action") {
        if (s.result) {
          if (e.action === "primary" && s.result.kind !== "loss" && shown > 0.5) next();
        } else if (e.action === "left") aim = Math.max(0, aim - 1);
        else if (e.action === "right") aim = Math.min(COLS - 1, aim + 1);
        else if ((e.action === "primary" || e.action === "down") && yourTurn()) play(aim);
      }
    });

    function disc(x: number, y: number, r: number, v: number, alpha = 1) {
      const [a, b] = v === s.you ? YOU : CPU;
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.28, y - r * 0.38, r * 0.42, r * 0.22, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function strip(y: number, v: Color, label: string, active: boolean, thinking: boolean) {
      const h = L.strip;
      pill(ctx, L.x, y, L.bw, h, active ? (v === s.you ? "rgba(255,122,69,0.9)" : "rgba(253,224,71,0.85)") : null);
      disc(L.x + 21, y + h / 2, 10, v);
      ctx.font = "600 14px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(label, L.x + 40, y + h / 2 + 1);
      if (thinking) dots(ctx, L.x + 48 + ctx.measureText(label).width, y + h / 2 + 1, time, reducedMotion);
    }

    return {
      update(dt) {
        time += dt;
        for (const f of falls) {
          f.vy += GRAVITY * dt;
          f.y += f.vy * dt;
          if (f.y >= f.target) {
            f.y = f.target;
            if (!f.hit) emit({ type: "feel", kind: "tap" }); // haptic when it lands, not when it's let go
            f.hit = true;
            f.vy = f.vy > 5 ? -f.vy * 0.26 : 0; // one small bounce, then rest
          }
        }
        falls = falls.filter((f) => f.y < f.target || f.vy !== 0);
        if (falls.length) hot = 1;

        if (s.result && !falls.length) {
          if (!settled) {
            settled = true;
            const k = s.result.kind;
            emit({ type: "feel", kind: k === "win" ? "success" : k === "loss" ? "fail" : "score" });
            if (k === "loss") overIn = 1.6;
          }
          if (shown < 1) {
            shown = Math.min(1, shown + dt / 0.35);
            hot = 1;
          }
          if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
        } else if (!s.result && s.turn !== s.you && !falls.length) {
          hot = 1;
          ai.step(dt, () => ({ grid: s.grid, turn: s.turn, level: s.level, seed: rng.int(0, 2 ** 30) }), (c) => {
            if (heightOf(s.grid, c) < ROWS) play(c);
          });
        }
        if (s.result && s.line.length && !reducedMotion) hot = 1; // the winning line pulses
        hot = Math.max(0, hot - dt);
      },

      render() {
        stage.host.dataset.ply = String(s.ply);
        if (hot <= 0 && stage.width === lastW && stage.height === lastH) return;
        lastW = stage.width;
        lastH = stage.height;
        L = layout();
        const { x: bx, y: by, cell, bw, bh } = L;
        const W = stage.width, H = stage.height;
        const r = cell * 0.39;
        ctx.clearRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W / 2, by + bh * 0.4, 0, W / 2, by + bh * 0.4, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(221,36,118,0.30)");
        glow.addColorStop(0.45, "rgba(255,81,47,0.12)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // Behind the frame: the slots, then the discs (so they show through the holes and fall behind it).
        ctx.fillStyle = "#100a22";
        ctx.beginPath();
        ctx.roundRect(bx - 4, by - 4, bw + 8, bh + 8, 16);
        ctx.fill();
        const falling = new Set(falls.map((f) => f.cell));
        for (let i = 0; i < ROWS * COLS; i++) {
          const v = s.grid[i];
          if (v && !falling.has(i)) disc(colX(i % COLS), rowY(ROWS - 1 - Math.floor(i / COLS)), r, v);
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, L.zoneY - cell, W, by + bh - L.zoneY + cell);
        ctx.clip();
        for (const f of falls) disc(colX(f.cell % COLS), rowY(f.y), r, f.v);
        ctx.restore();

        // The frame, with a hole per cell.
        const pad = Math.max(8, cell * 0.14);
        const frame = new Path2D();
        frame.roundRect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2, 20);
        for (let c = 0; c < COLS; c++)
          for (let row = 0; row < ROWS; row++) {
            frame.moveTo(colX(c) + r + 2, rowY(row));
            frame.arc(colX(c), rowY(row), r + 2, 0, Math.PI * 2);
          }
        const fg = ctx.createLinearGradient(bx, by - pad, bx + bw, by + bh + pad);
        fg.addColorStop(0, "#4c1d95");
        fg.addColorStop(0.55, "#2e1065");
        fg.addColorStop(1, "#1e0b45");
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = fg;
        ctx.fill(frame, "evenodd");
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2, 20);
        ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; // each hole's inner edge
        ctx.lineWidth = 2;
        for (let c = 0; c < COLS; c++)
          for (let row = 0; row < ROWS; row++) {
            ctx.beginPath();
            ctx.arc(colX(c), rowY(row), r + 2, Math.PI * 1.05, Math.PI * 1.95);
            ctx.stroke();
          }

        // The last disc gets a dot; a winning line gets rings that pulse.
        if (s.last >= 0 && !falling.has(s.last) && !s.line.length) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.beginPath();
          ctx.arc(colX(s.last % COLS), rowY(ROWS - 1 - Math.floor(s.last / COLS)), r * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
        if (s.line.length && !falls.length) {
          const pulse = reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(time * 5);
          ctx.save();
          ctx.shadowColor = "#ffffff";
          ctx.shadowBlur = 16 * pulse;
          ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`;
          ctx.lineWidth = Math.max(3, r * 0.16);
          for (const i of s.line) {
            ctx.beginPath();
            ctx.arc(colX(i % COLS), rowY(ROWS - 1 - Math.floor(i / COLS)), r * 0.86, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Your disc, waiting above the column it will drop into.
        if (yourTurn() && !falls.length) {
          ctx.fillStyle = `rgba(255,255,255,${pressing ? 0.07 : 0.035})`;
          ctx.beginPath();
          ctx.roundRect(bx + aim * cell + 3, by - 2, cell - 6, bh + 4, 12);
          ctx.fill();
          const full = heightOf(s.grid, aim) >= ROWS;
          disc(colX(aim), L.zoneY + cell * 0.55, r, s.you, full ? 0.25 : pressing ? 1 : 0.8);
        }

        const them = -s.you as Color;
        strip(L.topY, them, `${tier(s.level).name} · Lv ${s.level}`, !s.result && s.turn === them, !s.result && s.turn === them);
        strip(L.botY, s.you, s.ply === 0 && s.turn === s.you ? "You · your move first" : "You", yourTurn(), false);

        if (s.result && settled) {
          const res = s.result;
          banner(ctx, {
            cx: W / 2,
            cy: by + bh / 2,
            w: Math.min(bw - 16, 340),
            title: res.kind === "draw" ? "Board full" : "Four in a row",
            detail: res.kind === "win" ? `You win · +${res.points}` : res.kind === "draw" ? `Draw · +${res.points}` : `${tier(s.level).name} wins`,
            hint: res.kind === "loss" ? "" : `Tap for game ${s.games + 2} · ${res.kind === "win" ? `level ${s.level + 1} · ` : ""}${s.you === 1 ? "the engine starts" : "you start"}`,
            t: shown,
            colors: ["#ffb199", "#ff6cab"],
            reducedMotion,
          });
        }
      },

      serialize: () => s,
      restore(data) {
        s = data as FourState;
        ai.reset();
        falls = [];
        pressing = press = false;
        settled = false;
        shown = 0;
        overIn = -1;
        hot = 1;
      },
      destroy() {
        off();
        ai.reset();
      },
    };
  },
};

export default fourUp;
