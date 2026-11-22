import type { GameModule } from "@/engine/types";
import { banner, pill } from "../kit";
import { N, roundTime, makeDict, newGame, nextRound, neighbours, pathFor, pointsFor, tick, trace, type Dict, type HuntState } from "./logic";

const FEEDBACK = { word: "#4ade80", dup: "#fbbf24", nope: "#fb7185", short: "#fb7185" } as const;

const wordHunt: GameModule = {
  kind: "2d",
  create({ difficulty, stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let dict: Dict | null = null;
    let s: HuntState | null = null;
    let failed = false;
    // The word list is a static file, fetched on first play and then cached offline by the service worker.
    fetch("/words.txt")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        dict = makeDict(text);
        s ??= newGame(rng, dict, difficulty);
        hot = 1;
      })
      .catch(() => {
        failed = true;
        hot = 1;
      });

    let path: number[] = [];
    let typed = "";
    let flash: { kind: keyof typeof FEEDBACK; word: string; t: number } | null = null;
    let press: "next" | null = null;
    let shown = 0;
    let overIn = -1;
    let hot = 1;
    let lastW = 0, lastH = 0;

    function layout() {
      const ins = insets();
      const top = ins.top + 10;
      const size = Math.max(220, Math.min(stage.width - 40, (stage.height - ins.bottom - top - 52 - 70 - 140) * 1, 460));
      const x = Math.round((stage.width - size) / 2);
      const y = Math.round(top + 52 + 70);
      return { x, y, size, cell: size / N, infoY: top, wordY: top + 52 + 34, listY: y + size + 18 };
    }
    let L = layout();
    const cellCenter = (i: number) => ({ x: L.x + (i % N) * L.cell + L.cell / 2, y: L.y + Math.floor(i / N) * L.cell + L.cell / 2 });
    /** The cell under the finger, using a circle smaller than the tile so diagonals are easy to hit. */
    const cellAt = (px: number, py: number) => {
      for (let i = 0; i < N * N; i++) {
        const c = cellCenter(i);
        if (Math.hypot(px - c.x, py - c.y) < L.cell * 0.4) return i;
      }
      return -1;
    };

    function submit(cells: number[]) {
      if (!s || !dict || cells.length === 0) return;
      const before = s.score;
      const word = cells.map((c) => s!.grid[c]).join("");
      const r = trace(s, cells, dict);
      if (!r) return;
      flash = { kind: r, word, t: 0 };
      if (s.score !== before) emit({ type: "score", value: s.score });
      emit({ type: "feel", kind: r === "word" ? (word.length >= 6 ? "success" : "score") : "tap" });
    }
    function next() {
      if (!s || !dict) return;
      nextRound(s, rng, dict);
      path = [];
      typed = "";
      emit({ type: "feel", kind: "tap" });
    }

    // On a keyboard you can just type the word and press Enter.
    const onKey = (e: KeyboardEvent) => {
      if (!input.enabled || !s || e.metaKey || e.ctrlKey || e.altKey) return;
      if (s.roundOver) {
        if (e.key === "Enter" && s.alive) next();
        return;
      }
      if (/^[a-z]$/i.test(e.key) && typed.length < 16) typed += e.key.toLowerCase();
      else if (e.key === "Backspace") typed = typed.slice(0, -1);
      else if (e.key === "Enter") {
        const p = pathFor(s.grid, typed);
        if (p) submit(p);
        else if (typed) flash = { kind: "nope", word: typed, t: 0 };
        typed = "";
      } else return;
      hot = 1;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);

    const off = input.on((e) => {
      hot = 1;
      if (e.type !== "drag" || !s) return;
      if (e.phase === "start") {
        press = s.roundOver && s.alive ? "next" : null;
        typed = "";
        const c = s.alive && !s.roundOver ? cellAt(e.x, e.y) : -1;
        path = c >= 0 ? [c] : [];
        if (c >= 0) emit({ type: "feel", kind: "tap" });
      } else if (e.phase === "move") {
        if (!path.length) return;
        const c = cellAt(e.x, e.y);
        if (c < 0 || c === path[path.length - 1]) return;
        if (c === path[path.length - 2]) path.pop(); // slide back to undo a letter
        else if (!path.includes(c) && neighbours(path[path.length - 1]).includes(c)) path.push(c);
      } else {
        if (press === "next" && shown > 0.5) next();
        else if (path.length) submit(path);
        path = [];
        press = null;
      }
    });

    return {
      update(dt) {
        if (!s) return;
        const was = s.roundOver;
        tick(s, dt);
        if (!was && s.roundOver) {
          shown = 0;
          path = [];
          emit({ type: "feel", kind: s.alive ? "success" : "fail" });
          if (!s.alive) overIn = 2.2;
          else emit({ type: "score", value: s.score });
        }
        if (flash && (flash.t += dt) > 0.7) flash = null;
        if (s.roundOver && shown < 1) shown = Math.min(1, shown + dt / 0.35);
        if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
        hot = 1; // the clock is always ticking
      },

      render() {
        if (hot <= 0 && stage.width === lastW && stage.height === lastH) return;
        lastW = stage.width;
        lastH = stage.height;
        L = layout();
        const W = stage.width, H = stage.height, c = L.cell;
        ctx.clearRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, L.y + L.size / 2, 0, W / 2, L.y + L.size / 2, Math.max(W, H) * 0.75);
        glow.addColorStop(0, "rgba(253,160,133,0.22)");
        glow.addColorStop(0.5, "rgba(240,147,251,0.08)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (!s) {
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = "600 16px system-ui, sans-serif";
          ctx.fillText(failed ? "Couldn't load the word list. Check your connection once, then it works offline." : "Loading words…", W / 2, H / 2);
          return;
        }

        // Info: the clock drains along the pill; points against the target.
        pill(ctx, L.x, L.infoY, L.size, 40, null);
        const f = s.time / roundTime(s.d ?? 1);
        ctx.fillStyle = f < 0.15 ? "rgba(251,113,133,0.5)" : "rgba(253,160,133,0.3)";
        ctx.beginPath();
        ctx.roundRect(L.x + 3, L.infoY + 3, Math.max(0, (L.size - 6) * f), 34, 17);
        ctx.fill();
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.fillText(`Round ${s.level} · ${s.points} / ${s.target} pts`, L.x + 16, L.infoY + 21);
        ctx.textAlign = "right";
        ctx.fillText(`${Math.floor(s.time / 60)}:${String(Math.ceil(s.time % 60) % 60).padStart(2, "0")}`, L.x + L.size - 16, L.infoY + 21);

        // The word being traced (or typed), or the last result.
        const live = path.length ? path.map((i) => s!.grid[i]).join("") : typed;
        ctx.textAlign = "center";
        if (live) {
          ctx.font = "800 30px system-ui, sans-serif";
          ctx.fillStyle = "#fff";
          ctx.fillText(live.toUpperCase(), W / 2, L.wordY);
        } else if (flash) {
          const shake = flash.kind !== "word" && !reducedMotion ? Math.sin(flash.t * 40) * 5 * (1 - flash.t / 0.7) : 0;
          ctx.globalAlpha = 1 - flash.t / 0.7;
          ctx.font = "800 30px system-ui, sans-serif";
          ctx.fillStyle = FEEDBACK[flash.kind];
          const label = flash.kind === "word" ? `${flash.word.toUpperCase()} +${pointsFor(flash.word)}` : flash.kind === "dup" ? "Already found" : flash.kind === "short" ? "3 letters at least" : "Not a word";
          ctx.fillText(label, W / 2 + shake, L.wordY);
          ctx.globalAlpha = 1;
        }

        // Letters.
        const typedPath = typed ? pathFor(s.grid, typed) : null;
        const lit = new Set(path.length ? path : typedPath ?? []);
        if (path.length > 1) {
          ctx.strokeStyle = "rgba(240,147,251,0.55)";
          ctx.lineWidth = c * 0.16;
          ctx.lineCap = ctx.lineJoin = "round";
          ctx.beginPath();
          path.forEach((i, k) => {
            const p = cellCenter(i);
            if (k) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
          });
          ctx.stroke();
        }
        for (let i = 0; i < N * N; i++) {
          const p = cellCenter(i);
          const on = lit.has(i);
          const k = on && !reducedMotion ? 0.9 : 0.86;
          const g = ctx.createLinearGradient(p.x - c / 2, p.y - c / 2, p.x + c / 2, p.y + c / 2);
          g.addColorStop(0, on ? "#f6d365" : "#3a2f4a");
          g.addColorStop(1, on ? "#f093fb" : "#2a2238");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(p.x - (c * k) / 2, p.y - (c * k) / 2, c * k, c * k, c * 0.2);
          ctx.fill();
          ctx.fillStyle = on ? "#2a1230" : "#fdf4ff";
          ctx.font = `800 ${Math.round(c * 0.46)}px system-ui, sans-serif`;
          ctx.fillText(s.grid[i].toUpperCase(), p.x, p.y + c * 0.03);
        }

        // Found words, newest first, as chips.
        ctx.font = "600 13px system-ui, sans-serif";
        let x = L.x, y = L.listY;
        for (const w of [...s.found].reverse()) {
          const cw = ctx.measureText(w).width + 22;
          if (x + cw > L.x + L.size) {
            x = L.x;
            y += 32;
            if (y > H - insets().bottom - 30) break;
          }
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.beginPath();
          ctx.roundRect(x, y, cw, 26, 13);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillText(w, x + cw / 2, y + 14);
          x += cw + 6;
        }

        if (s.roundOver)
          banner(ctx, {
            cx: W / 2, cy: L.y + L.size / 2, w: Math.min(L.size, 320),
            title: s.alive ? "Round cleared" : "Time's up",
            detail: `${s.points} / ${s.target} pts · ${s.found.length} of ${s.possible} words`,
            hint: s.alive ? `Tap for round ${s.level + 1}` : "",
            t: shown, colors: ["#f6d365", "#f093fb"], reducedMotion,
          });
      },

      serialize: () => s,
      restore(data) {
        s = data as HuntState;
        path = [];
        typed = "";
        shown = s.roundOver ? 1 : 0;
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

export default wordHunt;
