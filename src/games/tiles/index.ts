import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { hasMove, isFree, match, newGame, nextBoard, shuffle, type TilesState } from "./logic";

const SUITS = ["#c2410c", "#0f766e"]; // faces: numerals 1–9 in two inks
const GONE = 0.22; // s for a matched pair to lift away

const tilesGame: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: TilesState = newGame(rng);
    let sel = -1;
    let nope: { i: number; t: number } | null = null;
    let leaving: { i: number; t: number }[] = [];
    let hint: [number, number] | null = null;
    let press: "shuffle" | "hint" | "next" | null = null;
    let cursor = -1;
    let shown = 0;
    let overIn = -1;
    let hot = 1;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const top = ins.top + 10;
      const avail = stage.height - ins.bottom - 12 - top - 52 - 70;
      const maxX = Math.max(...s.tiles.map((t) => t.x)) + 1, maxY = Math.max(...s.tiles.map((t) => t.y)) + 1;
      const layers = Math.max(...s.tiles.map((t) => t.z)) + 1;
      const tw = Math.floor(Math.min((stage.width - 32) / (maxX + layers * 0.14), avail / ((maxY + layers * 0.14) * 1.28), 70));
      const th = Math.round(tw * 1.28), d = Math.round(tw * 0.14);
      const bw = maxX * tw + layers * d, bh = maxY * th + layers * d;
      const x = Math.round((stage.width - bw) / 2) + layers * d, y = Math.round(top + 52 + Math.max(0, (avail - bh) / 2)) + layers * d;
      const by = y + maxY * th + 18;
      return {
        x, y, tw, th, d, infoY: y - layers * d - 52, infoX: (stage.width - Math.max(bw, 300)) / 2, infoW: Math.max(bw, 300),
        shuffle: { x: stage.width / 2 - 128, y: by, w: 120, h: 44 }, hint: { x: stage.width / 2 + 8, y: by, w: 120, h: 44 },
      };
    }
    const pos = (i: number) => {
      const t = s.tiles[i];
      return { x: L.x + t.x * L.tw - t.z * L.d, y: L.y + t.y * L.th - t.z * L.d };
    };
    const order = () => s.tiles.map((_, i) => i).sort((a, b) => s.tiles[a].z - s.tiles[b].z || s.tiles[a].y - s.tiles[b].y || s.tiles[a].x - s.tiles[b].x);
    const tileAt = (px: number, py: number) => {
      const o = order().reverse(); // topmost first
      return o.find((i) => {
        if (s.tiles[i].gone) return false;
        const p = pos(i);
        return px >= p.x && px <= p.x + L.tw && py >= p.y && py <= p.y + L.th;
      }) ?? -1;
    };
    const inRect = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

    function pick(i: number) {
      hint = null;
      if (i < 0 || !isFree(s.tiles, s.tiles[i])) {
        if (i >= 0) {
          nope = { i, t: 0 }; // blocked: a little shake says why nothing happened
          emit({ type: "feel", kind: "tap" });
        }
        return;
      }
      if (sel < 0 || sel === i) {
        sel = sel === i ? -1 : i;
        emit({ type: "feel", kind: "tap" });
        return;
      }
      const before = s.score;
      const r = match(s, sel, i);
      if (r === "nope") {
        nope = { i, t: 0 };
        sel = i;
        emit({ type: "feel", kind: "tap" });
        return;
      }
      if (!reducedMotion) leaving.push({ i: sel, t: 0 }, { i, t: 0 });
      sel = -1;
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (r === "cleared") {
        emit({ type: "feel", kind: "success" });
        shown = 0;
      } else if (r === "stuck" && !s.alive) {
        emit({ type: "feel", kind: "fail" });
        shown = 0;
        overIn = 1.8;
      } else emit({ type: "feel", kind: "score" });
    }
    function doShuffle() {
      if (shuffle(s, rng)) {
        sel = -1;
        hint = null;
        emit({ type: "feel", kind: "tap" });
      }
    }
    function doHint() {
      const free = s.tiles.map((t, i) => [t, i] as const).filter(([t]) => isFree(s.tiles, t));
      for (const [a, i] of free) for (const [b, j] of free) if (j > i && a.face === b.face) return void (hint = [i, j]);
    }
    function next() {
      nextBoard(s, rng);
      sel = -1;
      hint = null;
      leaving = [];
      L = layout();
      emit({ type: "feel", kind: "tap" });
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "action") {
        if (s.cleared) return void (e.action === "primary" && next());
        if (!s.alive) return;
        const free = order().filter((i) => isFree(s.tiles, s.tiles[i]));
        if (e.action === "left" || e.action === "up") cursor = free[(free.indexOf(cursor) - 1 + free.length) % free.length] ?? -1;
        else if (e.action === "right" || e.action === "down") cursor = free[(free.indexOf(cursor) + 1) % free.length] ?? -1;
        else if (e.action === "primary" && cursor >= 0) pick(cursor);
        else if (e.action === "secondary") doShuffle();
        return;
      }
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        press = s.cleared ? "next" : inRect(L.shuffle, e.x, e.y) ? "shuffle" : inRect(L.hint, e.x, e.y) ? "hint" : null;
        if (!press && s.alive && !s.cleared) {
          cursor = -1;
          pick(tileAt(e.x, e.y)); // selecting answers on press
        }
      } else if (e.phase === "end") {
        if (press === "next" && shown > 0.5) next();
        else if (press === "shuffle" && inRect(L.shuffle, e.x, e.y)) doShuffle();
        else if (press === "hint" && inRect(L.hint, e.x, e.y)) doHint();
        press = null;
      }
    });

    function tile(i: number, lift = 0, alpha = 1) {
      const t = s.tiles[i];
      const p = pos(i);
      const shake = nope?.i === i && !reducedMotion ? Math.sin(nope.t * 50) * 3 * (1 - nope.t / 0.3) : 0;
      const x = p.x + shake, y = p.y - lift;
      const free = isFree(s.tiles, t);
      ctx.save();
      ctx.globalAlpha = alpha;
      // Depth: the tile's side, then its face.
      ctx.fillStyle = "#b9a98c";
      ctx.beginPath();
      ctx.roundRect(x + L.d * 0.7, y + L.d * 0.7, L.tw, L.th, 8);
      ctx.fill();
      const g = ctx.createLinearGradient(x, y, x, y + L.th);
      g.addColorStop(0, "#fffaf0");
      g.addColorStop(1, "#ece2cf");
      ctx.fillStyle = g;
      if (i === sel || (hint && hint.includes(i))) {
        ctx.shadowColor = i === sel ? "#fbbf24" : "#a3e635";
        ctx.shadowBlur = 16;
      }
      ctx.beginPath();
      ctx.roundRect(x, y, L.tw - 2, L.th - 2, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (i === sel || (hint && hint.includes(i))) {
        ctx.strokeStyle = i === sel ? "#f59e0b" : "#84cc16";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      const ink = SUITS[t.face % 2];
      ctx.fillStyle = ink;
      ctx.font = `800 ${Math.round(L.tw * 0.56)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(Math.floor(t.face / 2) + 1), x + L.tw / 2 - 1, y + L.th / 2);
      ctx.beginPath();
      ctx.arc(x + L.tw / 2 - 1, y + L.th * 0.82, L.tw * 0.06, 0, Math.PI * 2); // the suit's dot
      ctx.fill();
      if (!free && alpha === 1) {
        ctx.fillStyle = "rgba(20,14,30,0.32)"; // blocked tiles sit back
        ctx.beginPath();
        ctx.roundRect(x, y, L.tw - 2, L.th - 2, 8);
        ctx.fill();
      }
      ctx.restore();
    }

    return {
      update(dt) {
        if (nope && (nope.t += dt) > 0.3) nope = null;
        leaving = leaving.filter((l) => (l.t += dt) < GONE);
        if (nope || leaving.length || hint) hot = 1;
        if (s.cleared || !s.alive) {
          if (shown < 1) {
            shown = Math.min(1, shown + dt / 0.35);
            hot = 1;
          }
          if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
        }
        hot = Math.max(0, hot - dt);
      },

      render() {
        if (hot <= 0 && stage.width === lastW && stage.height === lastH) return;
        lastW = stage.width;
        lastH = stage.height;
        L = layout();
        const W = stage.width, H = stage.height;
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(212,175,55,0.22)");
        glow.addColorStop(0.5, "rgba(138,110,47,0.08)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        const left = s.tiles.filter((t) => !t.gone).length;
        pill(ctx, L.infoX, L.infoY, L.infoW, 40, null);
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(`Stack ${s.level}`, L.infoX + 16, L.infoY + 21);
        ctx.textAlign = "right";
        ctx.fillText(`${left} tiles left`, L.infoX + L.infoW - 16, L.infoY + 21);

        for (const i of order()) if (!s.tiles[i].gone) tile(i);
        for (const l of leaving) tile(l.i, (l.t / GONE) * 24, 1 - l.t / GONE); // matched tiles lift and fade
        if (cursor >= 0 && !s.tiles[cursor].gone) {
          const p = pos(cursor);
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(p.x - 3, p.y - 3, L.tw + 4, L.th + 4, 10);
          ctx.stroke();
        }

        const stuck = s.alive && !s.cleared && !hasMove(s);
        for (const [b, label, on] of [[L.shuffle, `Shuffle · ${s.shuffles}`, s.shuffles > 0], [L.hint, "Hint", !stuck]] as const) {
          const held = press === (b === L.shuffle ? "shuffle" : "hint");
          ctx.fillStyle = b === L.shuffle && stuck && on ? "rgba(251,191,36,0.85)" : held && on ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)";
          ctx.strokeStyle = "rgba(255,255,255,0.1)";
          ctx.beginPath();
          ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = on ? "#fff" : "rgba(255,255,255,0.3)";
          ctx.font = "600 14px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
        }

        const cy = L.y + (L.shuffle.y - L.y) / 2 - 20;
        if (s.cleared)
          banner(ctx, { cx: W / 2, cy, w: Math.min(W - 40, 300), title: "Stack cleared", detail: `+${100 * s.level} bonus`, hint: `Tap for stack ${s.level + 1}`, t: shown, colors: ["#f3e7c3", "#d4af37"], reducedMotion });
        else if (!s.alive)
          banner(ctx, { cx: W / 2, cy, w: Math.min(W - 40, 300), title: "No moves left", detail: `Stack ${s.level} · ${s.score} points`, hint: "", t: shown, colors: ["#ffb199", "#ff5c7a"], reducedMotion });
        else if (stuck)
          banner(ctx, { cx: W / 2, cy, w: Math.min(W - 40, 300), title: "No pairs free", detail: "Shuffle the rest to carry on", hint: "", t: 1, colors: ["#f3e7c3", "#d4af37"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as TilesState;
        sel = -1;
        hint = null;
        leaving = [];
        shown = 0;
        overIn = s.alive ? -1 : 0.6;
        hot = 1;
      },
      destroy: off,
    };
  },
};

export default tilesGame;
