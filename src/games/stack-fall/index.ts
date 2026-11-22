import type { GameModule } from "@/engine/types";
import {
  COLS, HIDDEN, KINDS, ROWS, cellsOf, ghostY, hardDrop, hold, newGame, rotate, shift, softDrop, step,
  type Clear, type Kind, type StackState,
} from "./logic";

const VISIBLE = ROWS - HIDDEN;
const COLORS: Record<Kind, [string, string]> = {
  I: ["#22d3ee", "#3b82f6"],
  J: ["#818cf8", "#6d28d9"],
  L: ["#fdba74", "#f43f5e"],
  O: ["#fde047", "#f59e0b"],
  S: ["#86efac", "#10b981"],
  T: ["#f0abfc", "#a855f7"],
  Z: ["#fda4af", "#e11d48"],
};
const FLICK = 1100; // px/s for a hard drop / hold flick

const stackFall: GameModule = {
  kind: "2d",
  create({ difficulty, stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: StackState = newGame(rng, [1, 4, 8][difficulty]);
    let flashes: { rows: number[]; t: number }[] = [];
    let trail: { cells: [number, number][]; k: Kind; t: number; dist: number } | null = null;
    let L = layout();
    // Drag state: the piece follows the finger column by column; vertical drag soft-drops row by row.
    let drag: { col0: number; x0: number; rows: number; axis: "x" | "y" | null } | null = null;

    function layout() {
      const ins = insets();
      const strip = 64;
      const top = ins.top + 8;
      const availH = stage.height - top - ins.bottom - strip - 24;
      const cell = Math.max(8, Math.floor(Math.min((stage.width - 32) / COLS, availH / VISIBLE)));
      const bw = cell * COLS;
      const bh = cell * VISIBLE;
      const x = Math.round((stage.width - bw) / 2);
      const y = Math.round(top + strip + 16 + (availH - bh) / 2);
      return { cell, x, y, bw, bh, stripY: y - strip - 16, strip };
    }

    const report = (c: Clear | null, before: number) => {
      if (c) {
        if (c.rows.length) {
          flashes.push({ rows: c.rows, t: 0.35 });
          emit({ type: "feel", kind: c.rows.length === 4 ? "success" : "score" });
        } else emit({ type: "feel", kind: "tap" });
      }
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (!s.alive) {
        emit({ type: "feel", kind: "fail" });
        emit({ type: "over", score: s.score });
      }
    };
    const act = (fn: () => Clear | boolean | null) => {
      if (!s.alive) return;
      const before = s.score;
      const r = fn();
      report(typeof r === "object" ? r : null, before);
    };
    const drop = () =>
      act(() => {
        const from = cellsOf(s.cur).map(([x, y]) => [x, y] as [number, number]);
        const k = s.cur.k;
        const dist = ghostY(s) - s.cur.y;
        const c = hardDrop(s, rng);
        if (!reducedMotion && dist > 0) trail = { cells: from, k, t: 0.18, dist };
        return c;
      });

    const off = input.on((e) => {
      if (!s.alive) return;
      if (e.type === "tap") act(() => rotate(s, 1));
      else if (e.type === "action") {
        if (e.action === "left") act(() => shift(s, -1));
        else if (e.action === "right") act(() => shift(s, 1));
        else if (e.action === "up") act(() => rotate(s, 1));
        else if (e.action === "down") act(() => softDrop(s));
        else if (e.action === "primary") drop();
        else if (e.action === "secondary") act(() => hold(s, rng));
      } else if (e.type === "drag") {
        if (e.phase === "start") drag = { col0: s.cur.x, x0: s.cur.x, rows: 0, axis: null };
        if (!drag) return;
        if (e.phase === "move") {
          if (!drag.axis && Math.hypot(e.dx, e.dy) > 12) drag.axis = Math.abs(e.dx) > Math.abs(e.dy) ? "x" : "y";
          if (drag.axis === "x") {
            if (s.cur.x !== drag.x0) drag.col0 += s.cur.x - drag.x0; // piece changed (lock/kick): re-anchor
            const target = drag.col0 + Math.round(e.dx / (L.cell * 0.85));
            while (s.cur.x < target && shift(s, 1));
            while (s.cur.x > target && shift(s, -1));
            drag.x0 = s.cur.x;
          } else if (drag.axis === "y" && e.dy > 0) {
            const want = Math.floor(e.dy / L.cell);
            while (drag.rows < want) {
              drag.rows++;
              act(() => softDrop(s));
            }
          }
        } else if (e.phase === "end") {
          if (drag.axis === "y" && e.vy > FLICK && e.dy > L.cell) drop();
          else if (drag.axis === "y" && e.vy < -FLICK * 0.8 && e.dy < -L.cell) act(() => hold(s, rng));
          drag = null;
        }
      }
    });

    function block(x: number, y: number, size: number, k: Kind, alpha = 1) {
      const [a, b] = COLORS[k];
      const g = ctx.createLinearGradient(x, y, x + size, y + size);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      const r = Math.max(2, size * 0.2);
      const inset = Math.max(1, size * 0.05);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + inset, y + inset, size - inset * 2, size - inset * 2, r);
      ctx.fill();
      // Bevel: lit top-left edge, soft gloss.
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.roundRect(x + inset * 2.5, y + inset * 2.5, size - inset * 5, (size - inset * 5) * 0.38, r * 0.7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function mini(k: Kind | null, cx: number, cy: number, size: number, dim: boolean) {
      if (!k) return;
      const cells = cellsOf({ k, r: 0, x: 0, y: 0 });
      const xs = cells.map(([x]) => x);
      const ys = cells.map(([, y]) => y);
      const w = (Math.max(...xs) - Math.min(...xs) + 1) * size;
      const h = (Math.max(...ys) - Math.min(...ys) + 1) * size;
      for (const [x, y] of cells)
        block(cx - w / 2 + (x - Math.min(...xs)) * size, cy - h / 2 + (y - Math.min(...ys)) * size, size, k, dim ? 0.35 : 1);
    }

    function panel(x: number, y: number, w: number, h: number) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 16);
      ctx.fill();
      ctx.stroke();
    }

    return {
      update(dt) {
        flashes = flashes.map((f) => ({ ...f, t: f.t - dt })).filter((f) => f.t > 0);
        if (trail && (trail.t -= dt) <= 0) trail = null;
        const before = s.score;
        report(step(s, dt, rng), before);
      },

      render() {
        L = layout();
        const { cell } = L;
        const W = stage.width;
        const SH = stage.height;
        ctx.clearRect(0, 0, W, SH);

        // Backdrop: colourful glow behind the well.
        const glow = ctx.createRadialGradient(W / 2, L.y + L.bh * 0.3, 0, W / 2, L.y + L.bh * 0.3, Math.max(W, SH) * 0.7);
        glow.addColorStop(0, "rgba(63,94,251,0.28)");
        glow.addColorStop(0.5, "rgba(252,70,107,0.10)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, SH);

        // Top strip: hold · stats · next.
        const sy = L.stripY;
        // Panels shrink with the well, so on a narrow phone hold / stats / next never overlap.
        const box = Math.min(L.strip, Math.floor(L.bw / 4.3)); // hold + stats + next (2.2×) always fit
        const ms = box / 64;
        panel(L.x, sy, box, L.strip);
        panel(L.x + L.bw - box * 2.2, sy, box * 2.2, L.strip);
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.textAlign = "left";
        ctx.fillText("HOLD", L.x + 10, sy + 15);
        ctx.fillText("NEXT", L.x + L.bw - box * 2.2 + 10, sy + 15);
        mini(s.hold, L.x + box / 2, sy + L.strip / 2 + 6, 11 * ms, !s.canHold);
        mini(s.bag[0], L.x + L.bw - box * 1.55, sy + L.strip / 2 + 6, 11 * ms, false);
        mini(s.bag[1], L.x + L.bw - box * 0.85, sy + L.strip / 2 + 4, 8 * ms, false);
        mini(s.bag[2], L.x + L.bw - box * 0.32, sy + L.strip / 2 + 4, 6 * ms, false);
        ctx.textAlign = "center";
        const mid = (L.x + box + L.x + L.bw - box * 2.2) / 2;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(`LEVEL ${s.level}`, mid, sy + 22);
        ctx.font = "700 20px system-ui, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${s.lines}`, mid, sy + 46);
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText("LINES", mid, sy + 60);

        // The well.
        ctx.save();
        ctx.fillStyle = "rgba(10,10,22,0.72)";
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.roundRect(L.x - 6, L.y - 6, L.bw + 12, L.bh + 12, 18);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.beginPath();
        for (let x = 1; x < COLS; x++) {
          ctx.moveTo(L.x + x * cell + 0.5, L.y);
          ctx.lineTo(L.x + x * cell + 0.5, L.y + L.bh);
        }
        for (let y = 1; y < VISIBLE; y++) {
          ctx.moveTo(L.x, L.y + y * cell + 0.5);
          ctx.lineTo(L.x + L.bw, L.y + y * cell + 0.5);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(L.x, L.y, L.bw, L.bh);
        ctx.clip();

        const px = (x: number) => L.x + x * cell;
        const py = (y: number) => L.y + (y - HIDDEN) * cell;

        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++) {
            const v = s.board[y * COLS + x];
            if (v) block(px(x), py(y), cell, KINDS[v - 1], s.alive ? 1 : 0.5);
          }

        if (trail) {
          ctx.fillStyle = COLORS[trail.k][0];
          for (const [x, y] of trail.cells) {
            ctx.globalAlpha = (trail.t / 0.18) * 0.35;
            ctx.fillRect(px(x) + cell * 0.2, py(y), cell * 0.6, trail.dist * cell);
          }
          ctx.globalAlpha = 1;
        }

        if (s.alive) {
          // Ghost: outlined landing spot in the piece's colour.
          const gy = ghostY(s) - s.cur.y;
          ctx.strokeStyle = COLORS[s.cur.k][0];
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1.5;
          for (const [x, y] of cellsOf(s.cur)) {
            ctx.beginPath();
            ctx.roundRect(px(x) + 3, py(y + gy) + 3, cell - 6, cell - 6, cell * 0.18);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.save();
          ctx.shadowColor = COLORS[s.cur.k][1];
          ctx.shadowBlur = cell * 0.6;
          for (const [x, y] of cellsOf(s.cur)) block(px(x), py(y), cell, s.cur.k);
          ctx.restore();
        }

        for (const f of flashes) {
          ctx.fillStyle = `rgba(255,255,255,${(f.t / 0.35) * 0.8})`;
          // Rows already collapsed in state; flash where they were, which is now the top of the shifted stack.
          for (const y of f.rows) ctx.fillRect(L.x, py(y), L.bw, cell);
        }
        ctx.restore();
      },

      serialize: () => s,
      restore(data) {
        s = data as StackState;
        flashes = [];
        trail = null;
      },
      destroy: off,
    };
  },
};

export default stackFall;
