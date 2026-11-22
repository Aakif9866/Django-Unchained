import type { Action } from "@/engine/input";
import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { MAX_MISTAKES, conflicts, newGame, nextPuzzle, place, toggleNote, type NineState } from "./logic";

const ACCENT = "#4facfe";

const nine: GameModule = {
  kind: "2d",
  create({ difficulty, stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: NineState = newGame(rng, difficulty);
    let sel = 40;
    let notes = false;
    let wrong: { cell: number; d: number; t: number } | null = null;
    let pop: { cell: number; t: number } | null = null;
    let press: string | null = null; // which pad key is held
    let shown = 0;
    let overIn = -1;
    let hot = 1;
    let lastW = 0, lastH = 0;
    let L = layout();

    function layout() {
      const ins = insets();
      const top = ins.top + 10;
      const padH = 56 + 10 + 44;
      const avail = stage.height - ins.bottom - 12 - top - 52 - padH - 16;
      const size = Math.max(234, Math.floor(Math.min(stage.width - 20, avail, 600) / 9) * 9);
      const x = Math.round((stage.width - size) / 2);
      const y = Math.round(top + 52 + Math.max(0, (avail - size) / 2));
      const padY = y + size + 16;
      const key = Math.min(size / 9, 64);
      const keysX = Math.round((stage.width - key * 9) / 2);
      return { x, y, size, cell: size / 9, infoY: y - 52, padY, key, keysX, toolsY: padY + 66 };
    }
    const keyRect = (d: number) => ({ x: L.keysX + (d - 1) * L.key + 2, y: L.padY, w: L.key - 4, h: 56 });
    const toolRect = (k: 0 | 1) => ({ x: L.x + (k === 0 ? 0 : L.size / 2 + 5), y: L.toolsY, w: L.size / 2 - 5, h: 44 });
    const inRect = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

    function enter(d: number) {
      if (!s.alive || s.solved) return;
      if (notes) {
        if (toggleNote(s, sel, d)) emit({ type: "feel", kind: "tap" });
        return;
      }
      const before = s.score;
      const r = place(s, sel, d);
      if (!r) return;
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (r === "wrong") {
        wrong = { cell: sel, d, t: 0 };
        emit({ type: "feel", kind: "fail" });
        if (!s.alive) {
          shown = 0;
          overIn = 1.8;
        }
      } else {
        pop = { cell: sel, t: 0 };
        emit({ type: "feel", kind: r === "solved" ? "success" : "score" });
        if (r === "solved") shown = 0;
      }
    }
    function erase() {
      if (s.notes[sel]) {
        s.notes[sel] = 0;
        emit({ type: "feel", kind: "tap" });
      }
    }
    function next() {
      nextPuzzle(s, rng);
      sel = 40;
      emit({ type: "feel", kind: "tap" });
    }

    function onAction(a: Action) {
      if (s.solved) return void (a === "primary" && next());
      const r = Math.floor(sel / 9), c = sel % 9;
      if (a === "left") sel = r * 9 + Math.max(0, c - 1);
      else if (a === "right") sel = r * 9 + Math.min(8, c + 1);
      else if (a === "up") sel = Math.max(0, r - 1) * 9 + c;
      else if (a === "down") sel = Math.min(8, r + 1) * 9 + c;
      else if (a === "secondary") notes = !notes;
    }
    // Digits and Backspace aren't game actions, so listen for them directly (only while the game takes input).
    const onKey = (e: KeyboardEvent) => {
      if (!input.enabled || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "1" && e.key <= "9") enter(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete") erase();
      else if (e.key === "n" || e.key === "N") notes = !notes;
      else return;
      hot = 1;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);

    const off = input.on((e) => {
      hot = 1;
      if (e.type === "action") return onAction(e.action);
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        press = null;
        if (s.solved) return void (press = "next");
        const c = Math.floor((e.x - L.x) / L.cell), r = Math.floor((e.y - L.y) / L.cell);
        if (c >= 0 && c < 9 && r >= 0 && r < 9) sel = r * 9 + c; // selecting answers on press
        for (let d = 1; d <= 9; d++) if (inRect(keyRect(d), e.x, e.y)) press = String(d);
        if (inRect(toolRect(0), e.x, e.y)) press = "notes";
        if (inRect(toolRect(1), e.x, e.y)) press = "erase";
      } else if (e.phase === "end") {
        const p = press;
        press = null;
        if (p === "next") return void (shown > 0.5 && next());
        if (p === "notes" && inRect(toolRect(0), e.x, e.y)) notes = !notes;
        else if (p === "erase" && inRect(toolRect(1), e.x, e.y)) erase();
        else if (p && inRect(keyRect(Number(p)), e.x, e.y)) enter(Number(p)); // commit on release, slide off to cancel
      }
    });

    function button(b: { x: number; y: number; w: number; h: number }, label: string, on: boolean, held: boolean, dim = false) {
      ctx.fillStyle = on ? "rgba(79,172,254,0.85)" : held ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)";
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dim ? "rgba(255,255,255,0.25)" : "#fff";
      ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }

    return {
      update(dt) {
        if (wrong && (wrong.t += dt) > 0.6) wrong = null;
        if (pop && (pop.t += dt) > 0.25) pop = null;
        if (wrong || pop) hot = 1;
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
        const glow = ctx.createRadialGradient(W / 2, L.y + L.size * 0.4, 0, W / 2, L.y + L.size * 0.4, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(79,172,254,0.22)");
        glow.addColorStop(0.5, "rgba(67,233,123,0.06)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        pill(ctx, L.x, L.infoY, L.size, 40, null);
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(`Puzzle ${s.level} · ${s.grade}`, L.x + 16, L.infoY + 21);
        for (let k = 0; k < MAX_MISTAKES; k++) {
          // Hearts left: a mistake empties one.
          const hx = L.x + L.size - 20 - (MAX_MISTAKES - 1 - k) * 22, hy = L.infoY + 20;
          ctx.fillStyle = k < MAX_MISTAKES - s.mistakes ? "#ff5c7a" : "rgba(255,255,255,0.15)";
          ctx.beginPath();
          ctx.moveTo(hx, hy + 6);
          ctx.bezierCurveTo(hx - 10, hy - 2, hx - 5, hy - 9, hx, hy - 4);
          ctx.bezierCurveTo(hx + 5, hy - 9, hx + 10, hy - 2, hx, hy + 6);
          ctx.fill();
        }

        // Board.
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "#151b2b";
        ctx.beginPath();
        ctx.roundRect(L.x - 4, L.y - 4, L.size + 8, L.size + 8, 14);
        ctx.fill();
        ctx.restore();
        const sr = Math.floor(sel / 9), sc = sel % 9;
        const selV = s.grid[sel];
        for (let i = 0; i < 81; i++) {
          const r = Math.floor(i / 9), col = i % 9;
          const x = L.x + col * c, y = L.y + r * c;
          const peer = r === sr || col === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(col / 3) === Math.floor(sc / 3));
          let fill = "";
          if (i === sel) fill = "rgba(79,172,254,0.45)";
          else if (selV && s.grid[i] === selV) fill = "rgba(79,172,254,0.22)";
          else if (peer) fill = "rgba(255,255,255,0.05)";
          if (wrong?.cell === i) fill = `rgba(255,70,100,${0.6 * (1 - wrong.t / 0.6)})`;
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fillRect(x, y, c, c);
          }
          const v = s.grid[i];
          const shake = wrong?.cell === i && !reducedMotion ? Math.sin(wrong.t * 40) * 4 * (1 - wrong.t / 0.6) : 0;
          if (v) {
            const k = pop?.cell === i && !reducedMotion ? 1 + 0.25 * Math.sin((pop.t / 0.25) * Math.PI) : 1;
            ctx.fillStyle = s.givens[i] ? "#e8edf7" : conflicts(s.grid, i) ? "#ff7a8a" : ACCENT;
            ctx.font = `${s.givens[i] ? 700 : 600} ${Math.round(c * 0.56 * k)}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(String(v), x + c / 2, y + c / 2 + c * 0.04);
          } else if (wrong?.cell === i) {
            ctx.fillStyle = "#ff7a8a";
            ctx.font = `600 ${Math.round(c * 0.56)}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(String(wrong.d), x + c / 2 + shake, y + c / 2 + c * 0.04);
          } else if (s.notes[i]) {
            ctx.fillStyle = "rgba(200,215,240,0.8)";
            ctx.font = `600 ${Math.round(c * 0.24)}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            for (let d = 1; d <= 9; d++)
              if (s.notes[i] & (1 << d)) ctx.fillText(String(d), x + c * (0.2 + ((d - 1) % 3) * 0.3), y + c * (0.22 + Math.floor((d - 1) / 3) * 0.29));
          }
        }
        ctx.strokeStyle = "rgba(255,255,255,0.09)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 1; k < 9; k++) {
          if (k % 3 === 0) continue;
          ctx.moveTo(L.x + k * c + 0.5, L.y);
          ctx.lineTo(L.x + k * c + 0.5, L.y + L.size);
          ctx.moveTo(L.x, L.y + k * c + 0.5);
          ctx.lineTo(L.x + L.size, L.y + k * c + 0.5);
        }
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.32)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const k of [3, 6]) {
          ctx.moveTo(L.x + k * c, L.y);
          ctx.lineTo(L.x + k * c, L.y + L.size);
          ctx.moveTo(L.x, L.y + k * c);
          ctx.lineTo(L.x + L.size, L.y + k * c);
        }
        ctx.stroke();

        // Number pad: how many of each digit are left, under your thumb.
        ctx.textAlign = "center";
        for (let d = 1; d <= 9; d++) {
          const left = 9 - s.grid.filter((v) => v === d).length;
          ctx.font = "700 22px system-ui, sans-serif";
          button(keyRect(d), String(d), false, press === String(d), left === 0);
          if (left > 0) {
            ctx.font = "600 10px system-ui, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.45)";
            const b = keyRect(d);
            ctx.fillText(String(left), b.x + b.w / 2, b.y + b.h - 10);
          }
        }
        ctx.font = "600 14px system-ui, sans-serif";
        button(toolRect(0), notes ? "Notes on" : "Notes", notes, press === "notes");
        button(toolRect(1), "Erase notes", false, press === "erase");

        if (s.solved)
          banner(ctx, { cx: W / 2, cy: L.y + L.size / 2, w: Math.min(L.size - 16, 300), title: "Solved", detail: `Puzzle ${s.level} · ${s.mistakes} mistake${s.mistakes === 1 ? "" : "s"}`, hint: `Tap for puzzle ${s.level + 1}`, t: shown, colors: ["#4facfe", "#43e97b"], reducedMotion });
        else if (!s.alive)
          banner(ctx, { cx: W / 2, cy: L.y + L.size / 2, w: Math.min(L.size - 16, 300), title: "Three mistakes", detail: `Puzzle ${s.level} · ${s.score} points`, hint: "", t: shown, colors: ["#ffb199", "#ff5c7a"], reducedMotion });
      },

      serialize: () => s,
      restore(data) {
        s = data as NineState;
        wrong = pop = null;
        shown = 0;
        overIn = s.alive ? -1 : 0.6;
        hot = 1;
      },
      destroy() {
        off();
        window.removeEventListener("keydown", onKey);
      },
    };
  },
};

export default nine;
