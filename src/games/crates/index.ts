import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { LEVELS, newGame, nextLevel, restart, step, undo, type CratesState, type Dir } from "./logic";

const SLIDE = 0.09; // s per step

const crates: GameModule = {
  kind: "2d",
  create({ stage, input, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: CratesState = newGame();
    let anim: { me: number; crate: number; crateFrom: number; t: number; dir: Dir } | null = null;
    let queue: Dir[] = []; // a tapped walk, played one step at a time
    let facing: Dir = "down";
    let press: "undo" | "restart" | "next" | null = null;
    let tapCell = -1;
    let shown = 0;
    let overIn = -1;
    let hot = 1;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const top = ins.top + 10;
      const avail = stage.height - ins.bottom - 12 - top - 52 - 70;
      const cell = Math.max(20, Math.floor(Math.min((stage.width - 24) / s.w, avail / s.h, 72)));
      const bw = cell * s.w, bh = cell * s.h;
      const x = Math.round((stage.width - bw) / 2);
      const y = Math.round(top + 52 + Math.max(0, (avail - bh) / 2));
      const infoW = Math.max(bw, Math.min(stage.width - 24, 340));
      const by = y + bh + 18;
      return {
        x, y, cell, bw, bh, infoY: y - 52, infoX: (stage.width - infoW) / 2, infoW,
        undo: { x: stage.width / 2 - 128, y: by, w: 120, h: 44 }, restart: { x: stage.width / 2 + 8, y: by, w: 120, h: 44 },
      };
    }
    const inRect = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    const cellAt = (px: number, py: number) => {
      const c = Math.floor((px - L.x) / L.cell), r = Math.floor((py - L.y) / L.cell);
      return c >= 0 && c < s.w && r >= 0 && r < s.h ? r * s.w + c : -1;
    };

    function go(dir: Dir) {
      if (!s.alive || s.solved) return;
      const me = s.me, before = s.score;
      const crate = s.crates.slice();
      facing = dir;
      const r = step(s, dir);
      if (!r) {
        queue = [];
        return;
      }
      anim = reducedMotion ? null : { me, crate: r.pushed, crateFrom: r.pushed >= 0 ? crate[r.pushed] : -1, t: 0, dir };
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (r.solved) {
        queue = [];
        emit({ type: "feel", kind: "success" });
        shown = 0;
        if (s.finished) overIn = 2.2;
      } else if (!s.alive) {
        queue = [];
        emit({ type: "feel", kind: "fail" });
        shown = 0;
        overIn = 1.7;
      } else if (r.pushed >= 0) emit({ type: "feel", kind: s.marks[s.crates[r.pushed]] ? "score" : "tap" });
    }

    /** Shortest walk (no pushing) to a cell, as steps. */
    function walkTo(target: number): Dir[] {
      const prev = new Map<number, [number, Dir]>([[s.me, [-1, "down"]]]);
      const todo = [s.me];
      const moves: [Dir, number][] = [["up", -s.w], ["down", s.w], ["left", -1], ["right", 1]];
      while (todo.length) {
        const i = todo.shift()!;
        if (i === target) break;
        for (const [d, dd] of moves) {
          const j = i + dd;
          if ((d === "left" && i % s.w === 0) || (d === "right" && i % s.w === s.w - 1)) continue;
          if (j < 0 || j >= s.w * s.h || s.walls[j] || s.crates.includes(j) || prev.has(j)) continue;
          prev.set(j, [i, d]);
          todo.push(j);
        }
      }
      if (!prev.has(target)) return [];
      const path: Dir[] = [];
      for (let i = target; i !== s.me; i = prev.get(i)![0]) path.unshift(prev.get(i)![1]);
      return path;
    }

    function tapAt(cell: number) {
      if (cell < 0 || s.walls[cell]) return;
      const dr = Math.floor(cell / s.w) - Math.floor(s.me / s.w), dc = (cell % s.w) - (s.me % s.w);
      if (s.crates.includes(cell)) {
        // Tapping a crate next to you pushes it.
        if (Math.abs(dr) + Math.abs(dc) === 1) go(dr ? (dr > 0 ? "down" : "up") : dc > 0 ? "right" : "left");
        return;
      }
      queue = walkTo(cell);
    }
    function next() {
      nextLevel(s);
      anim = null;
      queue = [];
      L = layout();
      emit({ type: "feel", kind: "tap" });
    }

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "swipe") {
        queue = [];
        go(e.dir); // one step per swipe; a long drag keeps stepping
      } else if (e.type === "action") {
        if (s.solved && !s.finished) {
          if (e.action === "primary") next();
        } else if (e.action === "secondary") {
          if (undo(s)) emit({ type: "feel", kind: "tap" });
        } else if (e.action === "up" || e.action === "down" || e.action === "left" || e.action === "right") {
          queue = [];
          go(e.action);
        }
      } else if (e.type === "drag") {
        if (e.phase === "start") {
          press = s.solved && !s.finished ? "next" : inRect(L.undo, e.x, e.y) ? "undo" : inRect(L.restart, e.x, e.y) ? "restart" : null;
          tapCell = press ? -1 : cellAt(e.x, e.y);
        } else if (e.phase === "end") {
          if (press === "next" && shown > 0.5) next();
          else if (press === "undo" && inRect(L.undo, e.x, e.y) && undo(s)) emit({ type: "feel", kind: "tap" });
          else if (press === "restart" && inRect(L.restart, e.x, e.y) && restart(s)) emit({ type: "feel", kind: "tap" });
          press = null;
        }
      } else if (e.type === "tap") {
        if (tapCell >= 0 && s.alive && !s.solved) tapAt(tapCell);
      }
    });

    function crate(x: number, y: number, c: number, home: boolean) {
      const p = c * 0.1;
      const g = ctx.createLinearGradient(x, y, x, y + c);
      g.addColorStop(0, home ? "#f6d58b" : "#dfa579");
      g.addColorStop(1, home ? "#c98a2c" : "#9a6a46");
      ctx.save();
      if (home) {
        ctx.shadowColor = "#ffc94a";
        ctx.shadowBlur = c * 0.4;
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + p, y + p, c - p * 2, c - p * 2, c * 0.14);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(60,32,16,0.55)";
      ctx.lineWidth = Math.max(1.5, c * 0.06);
      ctx.beginPath();
      ctx.roundRect(x + p * 2.2, y + p * 2.2, c - p * 4.4, c - p * 4.4, c * 0.08);
      ctx.moveTo(x + p * 2.2, y + p * 2.2);
      ctx.lineTo(x + c - p * 2.2, y + c - p * 2.2);
      ctx.stroke();
    }

    return {
      update(dt) {
        if (anim) {
          anim.t += dt;
          if (anim.t >= SLIDE) anim = null;
          hot = 1;
        }
        if (!anim && queue.length && s.alive && !s.solved) {
          go(queue.shift()!);
          hot = 1;
        }
        if (s.solved || !s.alive) {
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
        const W = stage.width, H = stage.height, c = L.cell;
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, L.y + L.bh * 0.4, 0, W / 2, L.y + L.bh * 0.4, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(223,165,121,0.24)");
        glow.addColorStop(0.5, "rgba(199,144,129,0.08)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        pill(ctx, L.infoX, L.infoY, L.infoW, 40, null);
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(`Level ${s.level} of ${LEVELS.length}`, L.infoX + 16, L.infoY + 21);
        ctx.textAlign = "right";
        ctx.fillStyle = s.budget <= 5 && s.alive && !s.solved ? "#ff8a8a" : "rgba(255,255,255,0.92)";
        ctx.fillText(`${s.budget} steps left`, L.infoX + L.infoW - 16, L.infoY + 21);

        const at = (i: number) => ({ x: L.x + (i % s.w) * c, y: L.y + Math.floor(i / s.w) * c });
        // Floor only inside the walls: flood from you so the outside stays empty.
        const inside = new Set([s.me]);
        for (const todo = [s.me]; todo.length; ) {
          const i = todo.pop()!;
          for (const j of [i - s.w, i + s.w, i % s.w ? i - 1 : -1, i % s.w < s.w - 1 ? i + 1 : -1])
            if (j >= 0 && j < s.w * s.h && !s.walls[j] && !inside.has(j)) {
              inside.add(j);
              todo.push(j);
            }
        }
        for (const i of inside) {
          const p = at(i);
          ctx.fillStyle = (Math.floor(i / s.w) + (i % s.w)) % 2 ? "#2a1f1b" : "#2f2420";
          ctx.fillRect(p.x, p.y, c, c);
          if (s.marks[i]) {
            ctx.strokeStyle = "rgba(255,201,74,0.75)";
            ctx.lineWidth = Math.max(2, c * 0.07);
            ctx.beginPath();
            ctx.arc(p.x + c / 2, p.y + c / 2, c * 0.22, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        for (let i = 0; i < s.w * s.h; i++) {
          if (!s.walls[i]) continue;
          // Only walls that touch the floor are drawn, so the level has a clean outline.
          const near = [i - s.w, i + s.w, i - 1, i + 1, i - s.w - 1, i - s.w + 1, i + s.w - 1, i + s.w + 1].some((j) => inside.has(j));
          if (!near) continue;
          const p = at(i);
          const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + c);
          g.addColorStop(0, "#6b4a35");
          g.addColorStop(1, "#3d2a1e");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(p.x + 1, p.y + 1, c - 2, c - 2, c * 0.16);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(p.x + 3, p.y + 2, c - 6, c * 0.2);
        }

        const e = anim ? 1 - Math.pow(1 - anim.t / SLIDE, 2) : 1;
        s.crates.forEach((ci, k) => {
          let p = at(ci);
          if (anim && anim.crate === k) {
            const f = at(anim.crateFrom);
            p = { x: f.x + (p.x - f.x) * e, y: f.y + (p.y - f.y) * e };
          }
          crate(p.x, p.y, c, Boolean(s.marks[ci]) && !(anim && anim.crate === k));
        });

        // You: a round little mover that faces where it's going.
        let me = at(s.me);
        if (anim) {
          const f = at(anim.me);
          me = { x: f.x + (me.x - f.x) * e, y: f.y + (me.y - f.y) * e };
        }
        const cx = me.x + c / 2, cy = me.y + c / 2, r = c * 0.34;
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
        g.addColorStop(0, "#ffe9d6");
        g.addColorStop(1, "#ff7e5f");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        const [fx, fy] = facing === "up" ? [0, -1] : facing === "down" ? [0, 1] : facing === "left" ? [-1, 0] : [1, 0];
        ctx.fillStyle = "#2b1a12";
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(cx + fx * r * 0.35 + fy * side * r * 0.32, cy + fy * r * 0.35 + fx * side * r * 0.32, r * 0.11, 0, Math.PI * 2); // eyes: forward, spread sideways
          ctx.fill();
        }

        for (const [b, label, can] of [[L.undo, "Undo", s.history.length > 0], [L.restart, "Restart", s.history.length > 0]] as const) {
          const held = press === (label === "Undo" ? "undo" : "restart");
          ctx.fillStyle = held && can ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)";
          ctx.strokeStyle = "rgba(255,255,255,0.1)";
          ctx.beginPath();
          ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = can && s.alive && !s.solved ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)";
          ctx.font = "600 14px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
        }

        const bw = Math.min(W - 40, 300), bcy = L.y + L.bh / 2;
        if (s.finished)
          banner(ctx, { cx: W / 2, cy: bcy, w: bw, title: "Every crate home", detail: `All ${LEVELS.length} levels · ${s.score} points`, hint: "", t: shown, colors: ["#f6d58b", "#ff7e5f"], reducedMotion });
        else if (s.solved)
          banner(ctx, { cx: W / 2, cy: bcy, w: bw, title: "Level done", detail: `${s.moves} steps · +${100 * s.level + 10 * s.budget}`, hint: `Tap for level ${s.level + 1}`, t: shown, colors: ["#f6d58b", "#dfa579"], reducedMotion });
        else if (!s.alive)
          banner(ctx, { cx: W / 2, cy: bcy, w: bw, title: "Out of steps", detail: `Level ${s.level} · ${s.score} points`, hint: "", t: shown, colors: ["#ffb199", "#ff6e7f"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as CratesState;
        anim = null;
        queue = [];
        shown = 0;
        overIn = !s.alive || s.finished ? 0.6 : -1;
        hot = 1;
      },
      destroy: off,
    };
  },
};

export default crates;
