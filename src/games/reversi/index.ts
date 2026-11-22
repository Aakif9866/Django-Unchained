import type { Action } from "@/engine/input";
import { createRng } from "@/engine/rng";
import type { GameModule } from "@/engine/types";
import { banner, createThinker, dots, pill } from "../kit";
import { count, flipsFor, movesFor, newGame, nextGame, place, think, tier, type Color, type ReversiState } from "./logic";

const FLIP = 0.32; // s per disc
const RIPPLE = 0.05; // s between rings of flips, outward from the new disc
const LIME = "#a8e063";

const reversi: GameModule = {
  kind: "2d",
  create({ difficulty, stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: ReversiState = newGame([1, 2, 3][difficulty]);
    const ai = createThinker<{ board: number[]; turn: Color; level: number; seed: number }>(
      () => new Worker(new URL("./ai.worker.ts", import.meta.url)),
      (q) => think(q.board, q.turn, q.level, createRng(q.seed), () => performance.now()).move,
    );

    // View state: never saved, rebuilt from `s`.
    let flips: { sq: number; to: Color; t: number }[] = []; // t starts below 0 while a disc waits its turn
    let pop = { sq: -1, t: 1 };
    let ghost = -1; // legal square under the finger
    let pressing = false;
    let cursor = -1; // keyboard cursor; hidden until a key is pressed
    let toast = 0; // seconds left on the pass message
    let shown = 0;
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
      const avail = stage.height - ins.bottom - 6 - top - 2 * (strip + gap);
      const size = Math.max(160, Math.floor(Math.min(stage.width - 24, avail, 720) / 8) * 8);
      const x = Math.round((stage.width - size) / 2);
      const y = Math.round(top + strip + gap + Math.max(0, (avail - size) / 2));
      return { x, y, size, cell: size / 8, strip, topY: y - gap - strip, botY: y + size + gap };
    }
    const center = (sq: number) => ({ x: L.x + (sq & 7) * L.cell + L.cell / 2, y: L.y + (sq >> 3) * L.cell + L.cell / 2 });
    const sqAt = (x: number, y: number) => {
      const c = Math.floor((x - L.x) / L.cell), r = Math.floor((y - L.y) / L.cell);
      return c >= 0 && c < 8 && r >= 0 && r < 8 ? r * 8 + c : -1;
    };
    const yourTurn = () => !s.result && s.turn === s.you && !flips.length;
    const legalAt = (x: number, y: number) => {
      const sq = sqAt(x, y);
      return sq >= 0 && flipsFor(s.board, sq, s.you).length ? sq : -1;
    };

    function play(sq: number) {
      const mover = s.turn;
      const before = s.score;
      const f = place(s, sq);
      if (!f) return;
      if (!reducedMotion) {
        const r0 = sq >> 3, c0 = sq & 7;
        flips = f.map((i) => ({ sq: i, to: mover, t: -RIPPLE * (Math.max(Math.abs((i >> 3) - r0), Math.abs((i & 7) - c0)) - 1) }));
        pop = { sq, t: 0 };
      }
      if (s.passed) toast = 2.6;
      if (s.score !== before) emit({ type: "score", value: s.score });
      emit({ type: "feel", kind: mover === s.you && f.length >= 4 ? "score" : "tap" });
      if (s.result) {
        shown = 0;
        settled = false;
      }
      ghost = -1;
    }

    function next() {
      nextGame(s);
      flips = [];
      pop = { sq: -1, t: 1 };
      toast = 0;
      emit({ type: "feel", kind: "tap" });
    }

    function onAction(a: Action) {
      if (s.result) {
        if (a === "primary" && s.result.kind !== "loss" && shown > 0.5) next();
        return;
      }
      if (cursor < 0) {
        cursor = movesFor(s.board, s.you)[0] ?? 27; // the first key only reveals the cursor
        return;
      }
      const r = cursor >> 3, c = cursor & 7;
      if (a === "left") cursor = r * 8 + Math.max(0, c - 1);
      else if (a === "right") cursor = r * 8 + Math.min(7, c + 1);
      else if (a === "up") cursor = Math.max(0, r - 1) * 8 + c;
      else if (a === "down") cursor = Math.min(7, r + 1) * 8 + c;
      else if (a === "primary" && yourTurn() && flipsFor(s.board, cursor, s.you).length) play(cursor);
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "drag") {
        if (e.phase === "start") {
          cursor = -1;
          press = !!s.result && s.result.kind !== "loss";
          pressing = yourTurn();
          if (pressing) ghost = legalAt(e.x, e.y); // feedback on press; the disc goes down on release
        } else if (e.phase === "move") {
          if (pressing) ghost = legalAt(e.x, e.y);
        } else {
          if (press && shown > 0.5) next();
          else if (pressing && ghost >= 0 && yourTurn()) play(ghost); // slide off every legal square to cancel
          pressing = press = false;
          ghost = -1;
        }
      } else if (e.type === "action") onAction(e.action);
    });

    function disc(cx: number, cy: number, r: number, color: number, sx = 1, lift = 0, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.14, r * Math.max(0.15, sx), r * 0.98, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(cx, cy - lift);
      ctx.scale(Math.max(0.04, sx), 1);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r);
      g.addColorStop(0, color === 1 ? "#626b80" : "#ffffff");
      g.addColorStop(1, color === 1 ? "#0a0c12" : "#c3ccd9");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color === 1 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.16)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    function strip(y: number, color: Color, label: string, active: boolean, thinking: boolean) {
      const h = L.strip;
      pill(ctx, L.x, y, L.size, h, active ? "rgba(168,224,99,0.85)" : null);
      disc(L.x + 21, y + h / 2, 10, color);
      ctx.font = "600 14px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(label, L.x + 40, y + h / 2 + 1);
      if (thinking) dots(ctx, L.x + 48 + ctx.measureText(label).width, y + h / 2 + 1, time, reducedMotion);
      ctx.font = "700 18px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(String(count(s.board, color)), L.x + L.size - 16, y + h / 2 + 1);
    }

    return {
      update(dt) {
        time += dt;
        if (flips.length) {
          for (const f of flips) f.t += dt;
          flips = flips.filter((f) => f.t < FLIP);
          hot = 1;
        }
        if (pop.t < 1) {
          pop.t = Math.min(1, pop.t + dt / 0.22);
          hot = 1;
        }
        if (toast > 0 && (toast -= dt) <= 0) hot = 1;
        if (s.result && !flips.length) {
          if (!settled) {
            settled = true;
            const k = s.result.kind;
            emit({ type: "feel", kind: k === "win" ? "success" : k === "loss" ? "fail" : "score" });
            if (k === "loss") overIn = 1.8;
          }
          if (shown < 1) {
            shown = Math.min(1, shown + dt / 0.35);
            hot = 1;
          }
          if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
        } else if (!s.result && s.turn !== s.you && !flips.length) {
          hot = 1;
          ai.step(dt, () => ({ board: s.board, turn: s.turn, level: s.level, seed: rng.int(0, 2 ** 30) }), (sq) => {
            if (flipsFor(s.board, sq, s.turn).length) play(sq);
          });
        }
        hot = Math.max(0, hot - dt);
      },

      render() {
        stage.host.dataset.ply = String(s.ply);
        if (hot <= 0 && stage.width === lastW && stage.height === lastH) return;
        lastW = stage.width;
        lastH = stage.height;
        L = layout();
        const { x: bx, y: by, size, cell } = L;
        const W = stage.width, H = stage.height;
        const r = cell * 0.4;
        ctx.clearRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(W / 2, by + size * 0.45, 0, W / 2, by + size * 0.45, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(44,140,120,0.30)");
        glow.addColorStop(0.5, "rgba(168,224,99,0.07)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // The board: felt, grid, and the four star points.
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = 32;
        ctx.shadowOffsetY = 14;
        ctx.fillStyle = "#0b2a2a";
        ctx.beginPath();
        ctx.roundRect(bx - 8, by - 8, size + 16, size + 16, 20);
        ctx.fill();
        ctx.restore();
        const felt = ctx.createLinearGradient(bx, by, bx + size, by + size);
        felt.addColorStop(0, "#2a7d72");
        felt.addColorStop(0.5, "#1b5f58");
        felt.addColorStop(1, "#124643");
        ctx.fillStyle = felt;
        ctx.beginPath();
        ctx.roundRect(bx, by, size, size, 12);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < 8; i++) {
          ctx.moveTo(bx + i * cell + 0.5, by);
          ctx.lineTo(bx + i * cell + 0.5, by + size);
          ctx.moveTo(bx, by + i * cell + 0.5);
          ctx.lineTo(bx + size, by + i * cell + 0.5);
        }
        ctx.stroke();
        const sheen = ctx.createLinearGradient(bx, by, bx + size * 0.7, by + size);
        sheen.addColorStop(0, "rgba(255,255,255,0.10)");
        sheen.addColorStop(0.6, "rgba(255,255,255,0)");
        ctx.fillStyle = sheen;
        ctx.beginPath();
        ctx.roundRect(bx, by, size, size, 12);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        for (const [gx, gy] of [[2, 2], [6, 2], [2, 6], [6, 6]]) {
          ctx.beginPath();
          ctx.arc(bx + gx * cell + 0.5, by + gy * cell + 0.5, Math.max(2, cell * 0.06), 0, Math.PI * 2);
          ctx.fill();
        }

        // Where you can play.
        if (yourTurn()) {
          for (const sq of movesFor(s.board, s.you)) {
            const c = center(sq);
            ctx.strokeStyle = sq === ghost ? "rgba(168,224,99,0.95)" : "rgba(168,224,99,0.55)";
            ctx.lineWidth = Math.max(1.5, cell * 0.045);
            ctx.beginPath();
            ctx.arc(c.x, c.y, cell * 0.16, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (ghost >= 0) {
            const c = center(ghost);
            disc(c.x, c.y, r, s.you, 1, 0, 0.45);
          }
        }

        const turning = new Map(flips.map((f) => [f.sq, f]));
        for (let sq = 0; sq < 64; sq++) {
          const v = s.board[sq];
          if (!v) continue;
          const c = center(sq);
          const f = turning.get(sq);
          if (f) {
            const p = Math.max(0, Math.min(1, f.t / FLIP));
            disc(c.x, c.y, r, p < 0.5 ? -f.to : f.to, Math.abs(Math.cos(p * Math.PI)), Math.sin(p * Math.PI) * r * 0.3);
          } else if (sq === pop.sq && pop.t < 1) {
            const k = 1 + Math.sin(pop.t * Math.PI) * 0.12; // lands a touch big, then settles
            disc(c.x, c.y, r * k * (0.75 + 0.25 * Math.min(1, pop.t * 3)), v);
          } else disc(c.x, c.y, r, v);
        }
        if (s.last >= 0 && !s.result) {
          const c = center(s.last);
          ctx.fillStyle = LIME;
          ctx.beginPath();
          ctx.arc(c.x, c.y, Math.max(2.5, cell * 0.07), 0, Math.PI * 2);
          ctx.fill();
        }
        if (cursor >= 0) {
          const t = center(cursor);
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.roundRect(t.x - cell / 2 + 2, t.y - cell / 2 + 2, cell - 4, cell - 4, 7);
          ctx.stroke();
        }

        const them = -s.you as Color;
        strip(L.topY, them, `${tier(s.level).name} · Lv ${s.level}`, !s.result && s.turn === them, !s.result && s.turn === them);
        strip(L.botY, s.you, "You", yourTurn(), false);

        if (toast > 0 && s.passed && !s.result) {
          const text = s.passed === s.you ? `No move for you · ${tier(s.level).name} goes again` : `${tier(s.level).name} has no move · go again`;
          ctx.font = "600 13px system-ui, sans-serif";
          const w = ctx.measureText(text).width + 32;
          ctx.save();
          ctx.globalAlpha = Math.min(1, toast * 3);
          ctx.fillStyle = "rgba(14,20,24,0.92)";
          ctx.strokeStyle = "rgba(168,224,99,0.6)";
          ctx.beginPath();
          ctx.roundRect(W / 2 - w / 2, by + size - 52, w, 34, 17);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, W / 2, by + size - 35);
          ctx.restore();
        }

        if (s.result && settled) {
          const res = s.result;
          const name = tier(s.level).name;
          banner(ctx, {
            cx: W / 2,
            cy: by + size / 2,
            w: Math.min(size - 20, 340),
            title: res.kind === "win" ? "You win" : res.kind === "draw" ? "Draw" : `${name} wins`,
            detail: `${res.you}–${res.them}${res.points ? ` · +${res.points}` : ""}`,
            hint: res.kind === "loss" ? "" : `Tap for game ${s.games + 2} · ${res.kind === "win" ? `level ${s.level + 1} · ` : ""}you're ${s.you === 1 ? "White" : "Black"}`,
            t: shown,
            colors: ["#d4fc79", "#96e6a1"],
            reducedMotion,
          });
        }
      },

      serialize: () => s,
      restore(data) {
        s = data as ReversiState;
        ai.reset();
        flips = [];
        pop = { sq: -1, t: 1 };
        ghost = -1;
        pressing = press = false;
        toast = 0;
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

export default reversi;
