import type { Action } from "@/engine/input";
import { createRng } from "@/engine/rng";
import type { GameModule } from "@/engine/types";
import { banner, createThinker, dots, pill } from "../kit";
import {
  B, K, N, P, Q, R, VALUE, fileOf, fromOf, inCheck, kingSq, legalMoves, newGame, nextGame, play, promoOf, rankOf, resign,
  sqOf, think, tier, toOf, type Color, type GambitState, type Pos,
} from "./logic";

const LIGHT = "#dde2f2";
const DARK = "#7884bd";
const SLIDE = 0.16; // s
const PROMOS = [Q, N, R, B];
const START_SET = [0, 8, 2, 2, 2, 1, 1];

// Original piece silhouettes in a 100 × 100 box, as SVG path data (turned into Path2D on first draw).
const BASE = "M22 76h56a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5v-4a5 5 0 0 1 5-5Z";
const SHAPES: Record<number, { body: string; detail?: string }> = {
  [P]: { body: "M50 18a12 12 0 1 1 0 24a12 12 0 1 1 0-24Z M37 44h26a3 3 0 0 1 0 6H37a3 3 0 0 1 0-6Z M43 50h14c1 12 6 20 14 27H29c8-7 13-15 14-27Z" },
  [R]: { body: "M28 18h9v6h7.5v-6h11v6H63v-6h9v16l-6 5v24l8 14H26l8-14V39l-6-5Z", detail: "M34 39h32M34 63h32" },
  [N]: {
    body: "M30 77c-2-10 2-18 10-24c-6 0-11 1-15-2c-4-3-4-8-1-12l14-16c1-5 2-9 5-12l3 8c14 0 26 12 27 30c1 10-1 20-3 28Z",
    detail: "M50 22c10 4 16 14 17 26 M36.5 33a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0",
  },
  [B]: {
    body: "M50 10a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z M50 20c10 7 16 16 14 26c-1 6-4 10-7 12H43c-3-2-6-6-7-12c-2-10 4-19 14-26Z M36 58h28a3 3 0 0 1 0 6H36a3 3 0 0 1 0-6Z M42 64h16c1 6 5 10 11 13H31c6-3 10-7 11-13Z",
    detail: "M55 31l-9 13",
  },
  [Q]: {
    body: "M15.5 26a4.5 4.5 0 1 1 9 0a4.5 4.5 0 1 1-9 0Z M30.5 20a4.5 4.5 0 1 1 9 0a4.5 4.5 0 1 1-9 0Z M45.5 17a4.5 4.5 0 1 1 9 0a4.5 4.5 0 1 1-9 0Z M60.5 20a4.5 4.5 0 1 1 9 0a4.5 4.5 0 1 1-9 0Z M75.5 26a4.5 4.5 0 1 1 9 0a4.5 4.5 0 1 1-9 0Z M20 28L31 50L35 24L44 47L50 21L56 47L65 24L69 50L80 28L71 62H29Z M30 62h40a3 3 0 0 1 0 6H30a3 3 0 0 1 0-6Z M35 68h30c0 4 3 7 8 9H27c5-2 8-5 8-9Z",
    detail: "M28 56h44",
  },
  [K]: {
    body: "M47 4h6v6h6v6h-6v10h-6V16h-6v-6h6Z M50 24c12 0 20 6 20 14c0 8-6 14-8 24H38c-2-10-8-16-8-24c0-8 8-14 20-14Z M31 62h38a3 3 0 0 1 0 6H31a3 3 0 0 1 0-6Z M36 68h28c0 4 3 7 8 9H28c5-2 8-5 8-9Z",
    detail: "M34 52h32",
  },
};

const gambit: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: GambitState = newGame();
    const ai = createThinker<{ pos: Pos; level: number; seed: number }>(
      () => new Worker(new URL("./ai.worker.ts", import.meta.url)),
      (q) => think(q.pos, q.level, createRng(q.seed), () => performance.now()).move,
    );

    // View state: never saved, rebuilt from `s`.
    let sel = -1;
    let targets: number[] = [];
    let drag: { from: number; x: number; y: number; ox: number; oy: number; moved: boolean; again: boolean } | null = null;
    let promo: { from: number; to: number; i: number } | null = null;
    let cursor = -1; // keyboard cursor square; hidden until a key is pressed
    let slides: { piece: number; from: number; to: number }[] = [];
    let fade: { piece: number; sq: number } | null = null;
    let slideT = 1;
    let shown = 0; // result banner, 0 → 1
    let overIn = -1; // after a loss: seconds until the game-over sheet
    let confirm = 0; // resign asks twice; seconds left to confirm
    let press: "resign" | "next" | null = null;
    let hot = 1; // seconds left to keep repainting: a still board costs nothing
    let time = 0;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const strip = 40, gap = 10;
      const top = ins.top + 6;
      const avail = stage.height - ins.bottom - 6 - top - 2 * (strip + gap);
      const size = Math.max(160, Math.floor(Math.min(stage.width - 20, avail, 760) / 8) * 8);
      const x = Math.round((stage.width - size) / 2);
      const y = Math.round(top + strip + gap + Math.max(0, (avail - size) / 2));
      const botY = y + size + gap;
      return { x, y, size, cell: size / 8, strip, topY: y - gap - strip, botY, resign: { x: x + size - 96, y: botY, w: 96, h: strip } };
    }

    // You always sit at the bottom: as Black the board turns around.
    const crOf = (sq: number) => (s.you === 1 ? { c: fileOf(sq), r: sq >> 3 } : { c: 7 - fileOf(sq), r: 7 - (sq >> 3) });
    const sqOfCR = (c: number, r: number) => (s.you === 1 ? r * 8 + c : (7 - r) * 8 + (7 - c));
    const topLeft = (sq: number) => {
      const { c, r } = crOf(sq);
      return { x: L.x + c * L.cell, y: L.y + r * L.cell };
    };
    const center = (sq: number) => {
      const t = topLeft(sq);
      return { x: t.x + L.cell / 2, y: t.y + L.cell / 2 };
    };
    const sqAt = (x: number, y: number) => {
      const c = Math.floor((x - L.x) / L.cell), r = Math.floor((y - L.y) / L.cell);
      return c >= 0 && c < 8 && r >= 0 && r < 8 ? sqOfCR(c, r) : -1;
    };
    const inRect = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    const promoRect = (i: number) => ({ x: topLeft(promo!.to).x, y: L.y + i * L.cell, w: L.cell, h: L.cell });

    function select(sq: number) {
      sel = sq;
      targets = sq >= 0 ? legalMoves(s.pos).filter((m) => fromOf(m) === sq) : [];
    }

    function commit(m: number, slideMain: boolean) {
      const b = s.pos.board, from = fromOf(m), to = toOf(m), piece = b[from], mover = s.pos.turn;
      const capSq = Math.abs(piece) === P && to === s.pos.ep ? to + (mover === 1 ? 8 : -8) : to;
      const capPiece = b[capSq];
      const before = s.score;
      const r = play(s, m);
      slides = [];
      fade = null;
      if (!reducedMotion) {
        if (slideMain) slides.push({ piece, from, to });
        if (Math.abs(piece) === K && Math.abs(to - from) === 2)
          slides.push({ piece: R * mover, from: to > from ? to + 1 : to - 2, to: to > from ? to - 1 : to + 1 });
        if (capPiece && slideMain) fade = { piece: capPiece, sq: capSq };
        slideT = slides.length ? 0 : 1;
      }
      select(-1);
      promo = null;
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (s.result) settle();
      else emit({ type: "feel", kind: r.captured && mover === s.you ? "score" : "tap" });
      hot = 1;
    }

    function settle() {
      const k = s.result!.kind;
      shown = 0;
      emit({ type: "feel", kind: k === "win" ? "success" : k === "loss" ? "fail" : "score" });
      if (k === "loss") overIn = 1.8;
    }

    function next() {
      nextGame(s);
      select(-1);
      slides = [];
      fade = null;
      slideT = 1;
      confirm = 0;
      emit({ type: "feel", kind: "tap" });
    }

    function tryMove(from: number, to: number, slide: boolean) {
      const ms = targets.filter((m) => fromOf(m) === from && toOf(m) === to);
      if (ms.length > 1) promo = { from, to, i: 0 }; // promotion: ask which piece
      else if (ms.length) commit(ms[0], slide);
    }

    function pickPromo(i: number) {
      const p = promo;
      if (!p) return;
      const m = i < 0 ? undefined : targets.find((x) => fromOf(x) === p.from && toOf(x) === p.to && promoOf(x) === PROMOS[i]);
      if (m === undefined) promo = null;
      else commit(m, false);
    }

    function resignTap() {
      if (s.result) return;
      if (confirm > 0) {
        resign(s);
        confirm = 0;
        select(-1);
        promo = null;
        settle();
      } else confirm = 3;
    }

    function onDrag(e: { phase: "start" | "move" | "end"; x: number; y: number; dx: number; dy: number }) {
      if (e.phase === "start") {
        cursor = -1; // a touch hides the keyboard cursor
        press = null;
        if (s.result) {
          if (s.result.kind !== "loss") press = "next";
        } else if (inRect(L.resign, e.x, e.y)) press = "resign";
        else if (promo) {
          let i = -1;
          for (let k = 0; k < 4; k++) if (inRect(promoRect(k), e.x, e.y)) i = k;
          pickPromo(i);
        } else if (s.pos.turn === s.you) {
          const sq = sqAt(e.x, e.y);
          // Moves commit on press: the second tap of tap-tap feels instant.
          if (sq >= 0 && targets.some((m) => toOf(m) === sq)) tryMove(sel, sq, true);
          else if (sq >= 0 && s.pos.board[sq] * s.you > 0) {
            const again = sq === sel;
            select(sq);
            const c = center(sq);
            drag = { from: sq, x: e.x, y: e.y, ox: c.x - e.x, oy: c.y - e.y, moved: false, again };
          } else select(-1);
        }
      } else if (e.phase === "move") {
        if (drag) {
          drag.x = e.x;
          drag.y = e.y;
          if (Math.hypot(e.dx, e.dy) > 6) drag.moved = true;
        }
      } else {
        if (press === "resign" && inRect(L.resign, e.x, e.y)) resignTap();
        else if (press === "next" && shown > 0.5) next();
        press = null;
        const d = drag;
        drag = null;
        if (d?.moved) {
          const to = sqAt(d.x + d.ox, d.y + d.oy); // where the piece is, not the finger
          if (to >= 0 && to !== d.from) tryMove(d.from, to, false);
        } else if (d?.again) select(-1);
      }
    }

    function onAction(a: Action) {
      if (s.result) {
        if (a === "primary" && s.result.kind !== "loss" && shown > 0.5) next();
        return;
      }
      if (a === "secondary") return resignTap();
      if (promo) {
        if (a === "up" || a === "left") promo.i = (promo.i + 3) % 4;
        else if (a === "down" || a === "right") promo.i = (promo.i + 1) % 4;
        else if (a === "primary") pickPromo(promo.i);
        return;
      }
      if (cursor < 0) {
        cursor = sel >= 0 ? sel : sqOf(s.you === 1 ? "e2" : "e7"); // the first key only reveals the cursor
        return;
      }
      const { c, r } = crOf(cursor);
      const clamp = (v: number) => Math.max(0, Math.min(7, v));
      if (a === "left" || a === "right") cursor = sqOfCR(clamp(c + (a === "left" ? -1 : 1)), r);
      else if (a === "up" || a === "down") cursor = sqOfCR(c, clamp(r + (a === "up" ? -1 : 1)));
      else if (a === "primary" && s.pos.turn === s.you) {
        if (targets.some((m) => toOf(m) === cursor)) tryMove(sel, cursor, true);
        else select(s.pos.board[cursor] * s.you > 0 && cursor !== sel ? cursor : -1);
      }
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "drag") onDrag(e);
      else if (e.type === "action") onAction(e.action);
    });

    // ---------- drawing ----------
    let paths: Record<number, { body: Path2D; detail: Path2D | null }> | null = null;
    const whiteFill = ctx.createLinearGradient(0, 10, 0, 90);
    whiteFill.addColorStop(0, "#ffffff");
    whiteFill.addColorStop(1, "#d3d9e8");
    const blackFill = ctx.createLinearGradient(0, 10, 0, 90);
    blackFill.addColorStop(0, "#565e7c");
    blackFill.addColorStop(1, "#141724");

    function drawPiece(v: number, cx: number, cy: number, size: number, alpha = 1, lift = 0) {
      paths ??= Object.fromEntries(
        Object.entries(SHAPES).map(([t, sh]) => [t, { body: new Path2D(sh.body + BASE), detail: sh.detail ? new Path2D(sh.detail) : null }]),
      );
      const sh = paths[Math.abs(v)];
      const white = v > 0;
      const k = (size / 100) * (1 + lift * 0.1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx - 50 * k, cy - 50 * k - lift * size * 0.05);
      ctx.scale(k, k);
      ctx.fillStyle = `rgba(0,0,0,${0.18 + lift * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(50, 89 + lift * 5, 31, 5 + lift * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = white ? whiteFill : blackFill;
      ctx.fill(sh.body);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = white ? "rgba(22,26,44,0.8)" : "rgba(4,6,12,0.95)";
      ctx.stroke(sh.body);
      if (sh.detail) {
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = white ? "rgba(22,26,44,0.5)" : "rgba(255,255,255,0.4)";
        ctx.stroke(sh.detail);
      }
      ctx.restore();
    }

    /** Pieces `color` has lost (most valuable first); promoted extras make up for missing pawns. */
    function lost(color: Color) {
      const have = [0, 0, 0, 0, 0, 0, 0];
      for (const v of s.pos.board) if (v * color > 0) have[Math.abs(v)]++;
      const promoted = [N, B, R, Q].reduce((n, t) => n + Math.max(0, have[t] - START_SET[t]), 0);
      const out: number[] = [];
      for (const t of [Q, R, B, N]) for (let i = have[t]; i < START_SET[t]; i++) out.push(t);
      for (let i = have[P] + promoted; i < 8; i++) out.push(P);
      return out;
    }

    function strip(y: number, w: number, color: Color, label: string, active: boolean, thinking: boolean) {
      const h = L.strip;
      pill(ctx, L.x, y, w, h, active ? "rgba(165,180,252,0.9)" : null);
      drawPiece(K * color, L.x + 20, y + h / 2, 26);
      ctx.font = "600 14px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(label, L.x + 38, y + h / 2 + 1);
      let x = L.x + 44 + ctx.measureText(label).width;
      if (thinking) {
        dots(ctx, x, y + h / 2 + 1, time, reducedMotion);
        x += 26;
      }
      // What this side has taken, and the material lead.
      const taken = lost(-color as Color);
      const lead = taken.reduce((n, t) => n + VALUE[t], 0) - lost(color).reduce((n, t) => n + VALUE[t], 0);
      const right = L.x + w - 14;
      const leadText = lead > 0 ? `+${Math.round(lead / 100)}` : "";
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      if (leadText) ctx.fillText(leadText, right, y + h / 2 + 1);
      const end = right - (leadText ? ctx.measureText(leadText).width + 6 : 0);
      const step = Math.min(10, (end - x - 10) / Math.max(1, taken.length));
      if (step > 3) taken.forEach((t, i) => drawPiece(t * -color, end - 9 - (taken.length - 1 - i) * step, y + h / 2, 18));
    }

    return {
      update(dt) {
        time += dt;
        if (slideT < 1) {
          slideT = Math.min(1, slideT + dt / SLIDE);
          if (slideT >= 1) {
            slides = [];
            fade = null;
          }
          hot = 1;
        }
        if (confirm > 0 && (confirm -= dt) <= 0) hot = 1;
        if (s.result) {
          if (shown < 1) {
            shown = Math.min(1, shown + dt / 0.35);
            hot = 1;
          }
          if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
        } else if (s.pos.turn !== s.you) {
          hot = 1;
          ai.step(dt, () => ({ pos: s.pos, level: s.level, seed: rng.int(0, 2 ** 30) }), (m) => {
            if (legalMoves(s.pos).includes(m)) commit(m, true);
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
        ctx.clearRect(0, 0, W, H);

        const gy = by + size * 0.45;
        const glow = ctx.createRadialGradient(W / 2, gy, 0, W / 2, gy, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(141,160,210,0.28)");
        glow.addColorStop(0.5, "rgba(88,80,160,0.12)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = 34;
        ctx.shadowOffsetY = 14;
        ctx.fillStyle = "#262c48";
        ctx.beginPath();
        ctx.roundRect(bx - 7, by - 7, size + 14, size + 14, 18);
        ctx.fill();
        ctx.shadowColor = "transparent";
        const rim = ctx.createLinearGradient(bx, by, bx + size, by + size);
        rim.addColorStop(0, "rgba(199,210,254,0.9)");
        rim.addColorStop(0.5, "rgba(167,139,250,0.7)");
        rim.addColorStop(1, "rgba(240,171,252,0.8)");
        ctx.strokeStyle = rim;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bx, by, size, size, 11);
        ctx.clip();
        for (let r = 0; r < 8; r++)
          for (let c = 0; c < 8; c++) {
            ctx.fillStyle = (r + c) & 1 ? DARK : LIGHT;
            ctx.fillRect(bx + c * cell, by + r * cell, cell, cell);
          }
        const sheen = ctx.createLinearGradient(bx, by, bx + size, by + size);
        sheen.addColorStop(0, "rgba(255,255,255,0.12)");
        sheen.addColorStop(0.5, "rgba(255,255,255,0)");
        sheen.addColorStop(1, "rgba(40,30,90,0.10)");
        ctx.fillStyle = sheen;
        ctx.fillRect(bx, by, size, size);

        const tint = (sq: number, color: string) => {
          const t = topLeft(sq);
          ctx.fillStyle = color;
          ctx.fillRect(t.x, t.y, cell, cell);
        };
        if (s.last >= 0) {
          tint(fromOf(s.last), "rgba(255,204,92,0.38)");
          tint(toOf(s.last), "rgba(255,204,92,0.5)");
        }
        if (sel >= 0) tint(sel, "rgba(96,176,255,0.55)");
        if (inCheck(s.pos)) {
          const k = center(kingSq(s.pos.board, s.pos.turn));
          const g = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, cell * 0.72);
          g.addColorStop(0, "rgba(255,40,90,0.95)");
          g.addColorStop(0.6, "rgba(255,40,90,0.35)");
          g.addColorStop(1, "rgba(255,40,90,0)");
          ctx.fillStyle = g;
          ctx.fillRect(k.x - cell / 2, k.y - cell / 2, cell, cell);
        }

        ctx.font = `700 ${Math.max(8, Math.round(cell * 0.17))}px system-ui, sans-serif`;
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = (7 + i) & 1 ? LIGHT : DARK;
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillText("abcdefgh"[fileOf(sqOfCR(i, 7))], bx + (i + 1) * cell - 3, by + size - 2);
          ctx.fillStyle = i & 1 ? LIGHT : DARK;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(String(rankOf(sqOfCR(0, i)) + 1), bx + 3, by + i * cell + 3);
        }

        const hover = drag?.moved ? sqAt(drag.x + drag.ox, drag.y + drag.oy) : -1;
        for (const m of targets) {
          const t = toOf(m);
          if (promoOf(m) && promoOf(m) !== Q) continue; // one hint per promotion square
          const c = center(t);
          const capture = s.pos.board[t] !== 0 || (Math.abs(s.pos.board[fromOf(m)]) === P && t === s.pos.ep);
          ctx.fillStyle = ctx.strokeStyle = t === hover ? "rgba(96,176,255,0.75)" : "rgba(16,22,48,0.3)";
          ctx.beginPath();
          if (capture || t === hover) {
            ctx.lineWidth = cell * 0.08;
            ctx.arc(c.x, c.y, cell * 0.44, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.arc(c.x, c.y, cell * 0.15, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        const e = 1 - Math.pow(1 - slideT, 3);
        const hidden = new Set(slides.map((sl) => sl.to));
        if (drag?.moved) hidden.add(drag.from);
        for (let sq = 0; sq < 64; sq++) {
          const v = s.pos.board[sq];
          if (!v || hidden.has(sq)) continue;
          const c = center(sq);
          drawPiece(v, c.x, c.y, cell, 1, sq === sel && !reducedMotion ? 1 : 0);
        }
        if (fade) {
          const c = center(fade.sq);
          drawPiece(fade.piece, c.x, c.y, cell, 1 - e);
        }
        for (const sl of slides) {
          const a = center(sl.from), b = center(sl.to);
          drawPiece(sl.piece, a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, cell);
        }

        if (cursor >= 0 && !promo) {
          const t = topLeft(cursor);
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.roundRect(t.x + 2, t.y + 2, cell - 4, cell - 4, 7);
          ctx.stroke();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(10,14,30,0.6)";
          ctx.beginPath();
          ctx.roundRect(t.x + 5, t.y + 5, cell - 10, cell - 10, 4);
          ctx.stroke();
        }

        if (promo) {
          ctx.fillStyle = "rgba(8,10,22,0.55)";
          ctx.fillRect(bx, by, size, size);
          for (let i = 0; i < 4; i++) {
            const r = promoRect(i);
            ctx.fillStyle = "rgba(242,245,252,0.97)";
            ctx.beginPath();
            ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 12);
            ctx.fill();
            if (cursor >= 0 && i === promo.i) {
              ctx.lineWidth = 3;
              ctx.strokeStyle = "#6366f1";
              ctx.stroke();
            }
            drawPiece(PROMOS[i] * s.you, r.x + r.w / 2, r.y + r.h / 2, cell * 0.86);
          }
        }
        ctx.restore();

        if (drag?.moved) drawPiece(s.pos.board[drag.from], drag.x + drag.ox, drag.y + drag.oy, cell, 1, 1);

        // Strips: the engine above the board, you below.
        const them = -s.you as Color;
        strip(L.topY, size, them, `${tier(s.level).name} · Lv ${s.level}`, !s.result && s.pos.turn === them, !s.result && s.pos.turn === them);
        strip(L.botY, size - L.resign.w - 8, s.you, "You", !s.result && s.pos.turn === s.you, false);
        const rb = L.resign;
        const armed = confirm > 0;
        ctx.save();
        ctx.fillStyle = armed ? "rgba(244,63,94,0.9)" : press === "resign" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)";
        ctx.strokeStyle = armed ? "rgba(255,160,180,0.9)" : "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(rb.x, rb.y, rb.w, rb.h, rb.h / 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = "600 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = s.result ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.9)";
        ctx.fillText(armed ? "Sure?" : "Resign", rb.x + rb.w / 2, rb.y + rb.h / 2 + 1);
        ctx.restore();

        if (s.result) {
          const r = s.result;
          const titles: Record<string, string> = {
            mate: "Checkmate", resign: "Resigned", stalemate: "Stalemate", repetition: "Draw by repetition",
            fifty: "Fifty-move draw", material: "Dead draw",
          };
          const nextSide = (s.games + 1) % 2 === 0 ? "White" : "Black";
          banner(ctx, {
            cx: W / 2,
            cy: by + size / 2,
            w: Math.min(size - 20, 340),
            title: titles[r.why],
            detail: r.kind === "win" ? `You win · +${r.points}` : r.kind === "draw" ? `Draw · +${r.points}` : `${tier(s.level).name} wins`,
            hint: r.kind === "loss" ? "" : `Tap for game ${s.games + 2} · ${r.kind === "win" ? `level ${s.level + 1} · ` : ""}you're ${nextSide}`,
            t: shown,
            colors: ["#e0e7ff", "#a5b4fc"],
            reducedMotion,
          });
        }
      },

      serialize: () => s,
      restore(data) {
        s = data as GambitState;
        ai.reset();
        select(-1);
        drag = null;
        promo = null;
        slides = [];
        fade = null;
        slideT = 1;
        shown = s.result ? 1 : 0;
        overIn = s.result?.kind === "loss" ? 0.6 : -1;
        confirm = 0;
        press = null;
        hot = 1;
      },
      destroy() {
        off();
        ai.reset();
      },
    };
  },
};

export default gambit;
