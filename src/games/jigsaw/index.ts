import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { drawHero, heroName, W as IW, H as IH } from "./hero";
import { bringToFront, createPuzzle, drop, hint, placed, scatter, sides, tick, type JigsawState, type Level } from "./logic";

/** Classic knob, as (u along the edge, v outward × min cell side) bezier triples after a straight run to u = 0.35. */
const KNOB: [number, number][][] = [
  [[0.42, 0], [0.43, 0.06], [0.4, 0.12]],
  [[0.36, 0.2], [0.42, 0.27], [0.5, 0.27]],
  [[0.58, 0.27], [0.64, 0.2], [0.6, 0.12]],
  [[0.57, 0.06], [0.58, 0], [0.65, 0]],
];

function piecePath(sd: number[], ox: number, oy: number, w: number, h: number, m: number) {
  const p = new Path2D();
  const c = [[ox, oy], [ox + w, oy], [ox + w, oy + h], [ox, oy + h]];
  p.moveTo(ox, oy);
  for (let k = 0; k < 4; k++) {
    const [x0, y0] = c[k], [x1, y1] = c[(k + 1) % 4], s = sd[k];
    if (s) {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L; // outward normal (clockwise path)
      const P = ([u, v]: [number, number]): [number, number] => [x0 + dx * u + nx * v * m * s, y0 + dy * u + ny * v * m * s];
      p.lineTo(...P([0.35, 0]));
      for (const [a, b, e] of KNOB) p.bezierCurveTo(...P(a), ...P(b), ...P(e));
    }
    p.lineTo(x1, y1);
  }
  p.closePath();
  return p;
}

const jigsaw: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion, difficulty }) {
    const { ctx } = stage;
    let s: JigsawState = createPuzzle(rng, difficulty as Level);
    let hero = drawHero(s.seed);
    let name = heroName(s.seed);
    let cache: { key: string; img: HTMLCanvasElement[]; path: Path2D[]; pad: number } | null = null;
    let drag: { i: number; ox: number; oy: number; x: number; y: number; lift: number } | null = null;
    let reveal = 0, overIn = -1, flash = -1, flashT = 0;
    let L = layout();
    scatter(s, rng, trayCells());

    function layout() {
      const ins = insets();
      const W = stage.width, H = stage.height;
      const top = ins.top + 58, bottom = H - ins.bottom - 8;
      const portrait = W < H * 0.9;
      let bw: number, bx: number, tray: { x: number; y: number; w: number; h: number };
      if (portrait) {
        bw = Math.min(W - 24, ((bottom - top) * 0.5 * 16) / 9);
        bx = (W - bw) / 2;
        const ty = top + (bw * 9) / 16 + 14;
        tray = { x: 12, y: ty, w: W - 24, h: bottom - ty };
      } else {
        bw = Math.min(W * 0.66, ((bottom - top) * 16) / 9);
        const tw = Math.max(160, W - bw - 52);
        bx = Math.max(16, (W - bw - tw - 20) / 2);
        tray = { x: bx + bw + 20, y: top, w: W - (bx + bw + 20) - 12, h: bottom - top };
      }
      const bh = (bw * 9) / 16;
      return { bx, by: top, bw, bh, cw: bw / s.cols, ch: bh / s.rows, tray, top, bottom, W, H };
    }
    function trayCells() {
      const t = L.tray;
      return { x: (t.x - L.bx) / L.cw, y: (t.y - L.by) / L.ch, w: t.w / L.cw, h: t.h / L.ch };
    }
    /** Keeps loose pieces on screen after a resize or rotation. */
    function clampLoose() {
      for (const p of s.pieces) {
        if (p.done) continue;
        p.x = Math.min(Math.max(p.x, (8 - L.bx) / L.cw), (L.W - 8 - L.bx) / L.cw - 1);
        p.y = Math.min(Math.max(p.y, (L.top - L.by) / L.ch), (L.bottom - L.by) / L.ch - 1);
      }
    }

    /** Cuts every piece once at the current size: its own canvas (picture, bevel, outline) and its outline path. */
    function pieces() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const key = `${s.seed}|${s.cols}|${L.cw.toFixed(2)}|${L.ch.toFixed(2)}|${dpr}`;
      if (cache?.key === key) return cache;
      const m = Math.min(L.cw, L.ch), pad = Math.ceil(m * 0.3) + 2;
      const img: HTMLCanvasElement[] = [], path: Path2D[] = [];
      for (let i = 0; i < s.pieces.length; i++) {
        const c = i % s.cols, r = Math.floor(i / s.cols);
        const pp = piecePath(sides(s, i), pad, pad, L.cw, L.ch, m);
        const cv = document.createElement("canvas");
        cv.width = Math.ceil((L.cw + pad * 2) * dpr);
        cv.height = Math.ceil((L.ch + pad * 2) * dpr);
        const g = cv.getContext("2d")!;
        g.scale(dpr, dpr);
        g.save();
        g.clip(pp);
        g.drawImage(hero, 0, 0, IW, IH, pad - c * L.cw, pad - r * L.ch, L.bw, L.bh);
        g.strokeStyle = "rgba(255,255,255,0.35)";
        g.lineWidth = 2.5;
        g.stroke(pp); // inner highlight (half of it survives the clip)
        g.restore();
        g.strokeStyle = "rgba(0,0,0,0.45)";
        g.lineWidth = 1;
        g.stroke(pp);
        img.push(cv);
        path.push(pp);
      }
      return (cache = { key, img, path, pad });
    }

    const toPx = (x: number, y: number) => ({ x: L.bx + x * L.cw, y: L.by + y * L.ch });
    function pieceAt(px: number, py: number) {
      for (let k = s.order.length - 1; k >= 0; k--) {
        const i = s.order[k], p = s.pieces[i];
        if (p.done) continue;
        const q = toPx(p.x, p.y);
        if (px >= q.x - 4 && px <= q.x + L.cw + 4 && py >= q.y - 4 && py <= q.y + L.ch + 4) return i;
      }
      return -1;
    }
    function snapped(i: number) {
      flash = i;
      flashT = 0;
      emit({ type: "score", value: s.score });
      if (s.solved) {
        emit({ type: "feel", kind: "success" });
        emit({ type: "score", value: s.score });
        overIn = 2.8;
      } else emit({ type: "feel", kind: "score" });
    }

    const off = input.on((e) => {
      if (s.solved) return;
      if (e.type === "action" && e.action === "primary") {
        const i = hint(s);
        if (i >= 0) snapped(i);
        return;
      }
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        const i = pieceAt(e.x, e.y);
        if (i < 0) return;
        const q = toPx(s.pieces[i].x, s.pieces[i].y);
        bringToFront(s, i);
        drag = { i, ox: e.x - q.x, oy: e.y - q.y, x: e.x, y: e.y, lift: reducedMotion ? 1 : 0 };
        emit({ type: "feel", kind: "tap" });
      } else if (drag) {
        drag.x = Math.min(Math.max(e.x, 0), L.W);
        drag.y = Math.min(Math.max(e.y, L.top - 20), L.H);
        if (e.phase === "end") {
          const i = drag.i;
          const nx = (drag.x - drag.ox - L.bx) / L.cw, ny = (drag.y - drag.oy - L.by) / L.ch;
          drag = null;
          if (drop(s, i, nx, ny)) snapped(i);
        }
      }
    });

    return {
      update(dt) {
        tick(s, dt);
        if (drag && drag.lift < 1) drag.lift = Math.min(1, drag.lift + dt / 0.12);
        if (flash >= 0 && (flashT += dt) > 0.4) flash = -1;
        if (s.solved) {
          reveal = reducedMotion ? 1 : Math.min(1, reveal + dt / 0.9);
          if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
        }
      },

      render() {
        if (stage.width !== L.W || stage.height !== L.H) {
          L = layout();
          clampLoose();
        }
        const { W, H } = L;
        const pc = pieces();
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(L.bx + L.bw / 2, L.by + L.bh / 2, 0, L.bx + L.bw / 2, L.by + L.bh / 2, Math.max(W, H) * 0.8);
        glow.addColorStop(0, "rgba(255,81,47,0.18)");
        glow.addColorStop(0.5, "rgba(91,36,122,0.10)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // Strip: progress and clock
        const sx = Math.min(L.bx, L.tray.x), sw = Math.max(L.bx + L.bw, L.tray.x + L.tray.w) - sx;
        const sy = L.top - 50;
        pill(ctx, sx, sy, sw, 40, null);
        const f = placed(s) / s.pieces.length;
        ctx.fillStyle = "rgba(240,152,25,0.35)";
        ctx.beginPath();
        ctx.roundRect(sx + 3, sy + 3, Math.max(0, (sw - 6) * f), 34, 17);
        ctx.fill();
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.textAlign = "left";
        ctx.fillText(`${placed(s)} / ${s.pieces.length} placed`, sx + 16, sy + 21);
        ctx.textAlign = "right";
        const t = Math.floor(s.time);
        ctx.fillText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`, sx + sw - 16, sy + 21);

        // Board with a guide: faint picture on Easy, grid on Medium, nothing on Hard
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.beginPath();
        ctx.roundRect(L.bx - 2, L.by - 2, L.bw + 4, L.bh + 4, 8);
        ctx.fill();
        ctx.stroke();
        if (difficulty === 0) {
          ctx.globalAlpha = 0.2;
          ctx.drawImage(hero, L.bx, L.by, L.bw, L.bh);
        } else if (difficulty === 1) {
          ctx.strokeStyle = "rgba(255,255,255,0.08)";
          ctx.beginPath();
          for (let c = 1; c < s.cols; c++) {
            ctx.moveTo(L.bx + c * L.cw, L.by);
            ctx.lineTo(L.bx + c * L.cw, L.by + L.bh);
          }
          for (let r = 1; r < s.rows; r++) {
            ctx.moveTo(L.bx, L.by + r * L.ch);
            ctx.lineTo(L.bx + L.bw, L.by + r * L.ch);
          }
          ctx.stroke();
        }
        ctx.restore();

        // Tray outline (where loose pieces live)
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.roundRect(L.tray.x, L.tray.y, L.tray.w, L.tray.h, 14);
        ctx.stroke();
        ctx.setLineDash([]);

        const drawPiece = (i: number, x: number, y: number, lifted: number, loose: boolean) => {
          ctx.save();
          ctx.translate(x - pc.pad, y - pc.pad);
          if (lifted > 0) {
            const k = 1 + 0.06 * lifted, cx = pc.pad + L.cw / 2, cy = pc.pad + L.ch / 2;
            ctx.translate(cx, cy);
            ctx.scale(k, k);
            ctx.translate(-cx, -cy);
          }
          if (loose) {
            ctx.save();
            ctx.translate(2 + 6 * lifted, 3 + 8 * lifted);
            ctx.fillStyle = `rgba(0,0,0,${0.35 + 0.15 * lifted})`;
            ctx.fill(pc.path[i]);
            ctx.restore();
          }
          ctx.drawImage(pc.img[i], 0, 0, L.cw + pc.pad * 2, L.ch + pc.pad * 2);
          if (i === flash) {
            ctx.globalAlpha = 1 - flashT / 0.4;
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fill(pc.path[i]);
          }
          ctx.restore();
        };
        for (const i of s.order) if (s.pieces[i].done) { const q = toPx(s.pieces[i].x, s.pieces[i].y); drawPiece(i, q.x, q.y, 0, false); }
        for (const i of s.order) {
          const p = s.pieces[i];
          if (p.done || drag?.i === i) continue;
          const q = toPx(p.x, p.y);
          drawPiece(i, q.x, q.y, 0, true);
        }
        if (drag) drawPiece(drag.i, drag.x - drag.ox, drag.y - drag.oy, drag.lift, true);

        if (s.solved) {
          ctx.save();
          ctx.globalAlpha = reveal;
          ctx.drawImage(hero, L.bx, L.by, L.bw, L.bh);
          ctx.restore();
          banner(ctx, {
            cx: L.bx + L.bw / 2, cy: Math.min(L.by + L.bh + 70, H - 80), w: Math.min(W - 40, 320), title: name,
            detail: `Hero #${s.seed} · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`, hint: `${s.score} points`,
            t: reveal, colors: ["#f9d423", "#ff512f"], reducedMotion,
          });
        }
      },

      serialize: () => s,
      restore(data) {
        const next = data as JigsawState;
        if (next.seed !== s.seed) {
          hero = drawHero(next.seed);
          name = heroName(next.seed);
        }
        s = next;
        cache = null;
        drag = null;
        L = layout();
        clampLoose();
        reveal = s.solved ? 1 : 0;
        overIn = s.solved ? 0.6 : -1;
      },
      destroy: off,
    };
  },
};

export default jigsaw;
