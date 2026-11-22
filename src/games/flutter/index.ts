import type { GameModule } from "@/engine/types";
import { H, PIPE_W, R, flap, newGame, step, type FlutterState } from "./logic";

const PILLAR = ["#a8ff78", "#78ffd6", "#38bdf8"];
const BIRD = ["#ffe29f", "#ffa99f", "#ff719a"];

interface Puff {
  x: number; // world units
  y: number;
  life: number;
}

/** Cheap deterministic hash → [0,1), so the starfield is stable without storing it. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

const flutter: GameModule = {
  kind: "2d",
  create({ difficulty, stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: FlutterState = newGame(rng, difficulty);
    let wing = 0; // seconds since last flap, drives the wing beat
    let shake = 0;
    let puffs: Puff[] = [];

    const doFlap = () => {
      if (!s.alive) return;
      flap(s);
      wing = 0;
      if (!reducedMotion) puffs.push({ x: s.x - R, y: s.y + R * 0.6, life: 1 });
      emit({ type: "feel", kind: "tap" });
    };
    // Flap on pointer-down (drag start), not on release: response must be instant.
    const off = input.on((e) => {
      if (e.type === "drag" && e.phase === "start") doFlap();
      else if (e.type === "action" && (e.action === "primary" || e.action === "up")) doFlap();
    });

    function view() {
      const ins = insets();
      const top = ins.top + 8;
      const h = Math.max(100, stage.height - top - ins.bottom - 8);
      // Portrait phones are tall: cap the zoom by width too so ~75 units (more than one gap ahead) stay visible.
      const k = Math.min(h / H, stage.width / 75);
      return { top: top + (h - H * k) / 2, k, birdX: Math.min(stage.width * 0.28, 220) };
    }

    return {
      update(dt) {
        wing += dt;
        shake = Math.max(0, shake - dt * 2.5);
        puffs = puffs.map((p) => ({ ...p, life: p.life - dt * 2.2 })).filter((p) => p.life > 0);
        const r = step(s, dt, rng);
        if (r === "score") {
          emit({ type: "score", value: s.score });
          emit({ type: "feel", kind: s.score % 10 === 0 ? "success" : "score" });
        } else if (r === "dead") {
          shake = 1;
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.score });
        }
      },

      render(alpha) {
        const W = stage.width;
        const SH = stage.height;
        const { top, k, birdX } = view();
        const bx = s.px + (s.x - s.px) * alpha;
        const by = s.py + (s.y - s.py) * alpha;
        const cam = bx; // world x at birdX
        const sx = (x: number) => birdX + (x - cam) * k;
        const sy = (y: number) => top + y * k;

        // Sky: deep night with a colourful horizon glow.
        const sky = ctx.createLinearGradient(0, 0, 0, SH);
        sky.addColorStop(0, "#07071a");
        sky.addColorStop(0.55, "#16123d");
        sky.addColorStop(0.85, "#1d3b5c");
        sky.addColorStop(1, "#0d4b4f");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, SH);

        ctx.save();
        if (shake > 0 && !reducedMotion) ctx.translate((hash(s.t * 99) - 0.5) * 10 * shake, (hash(s.t * 77) - 0.5) * 10 * shake);

        // Stars, parallax 0.05.
        const starCam = cam * k * 0.05;
        const cellW = 70;
        for (let i = Math.floor(starCam / cellW) - 1; i < (starCam + W) / cellW + 1; i++) {
          const x = i * cellW - starCam + hash(i) * cellW;
          const y = hash(i + 0.5) * SH * 0.6;
          ctx.globalAlpha = 0.25 + hash(i + 0.25) * 0.55;
          ctx.fillStyle = "#fff";
          ctx.fillRect(x, y, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;

        // Two layers of soft hills.
        const hills = (par: number, base: number, amp: number, c0: string, c1: string) => {
          const off = cam * k * par;
          const g = ctx.createLinearGradient(0, base - amp, 0, SH);
          g.addColorStop(0, c0);
          g.addColorStop(1, c1);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, SH);
          for (let x = 0; x <= W + 20; x += 20) {
            const wx = (x + off) / 160;
            ctx.lineTo(x, base - amp * (0.5 + 0.3 * Math.sin(wx) + 0.2 * Math.sin(wx * 2.3 + 1)));
          }
          ctx.lineTo(W, SH);
          ctx.fill();
        };
        hills(0.15, SH * 0.82, SH * 0.18, "rgba(124,77,255,0.45)", "rgba(20,10,50,0.2)");
        hills(0.35, SH * 0.9, SH * 0.14, "rgba(56,189,248,0.4)", "rgba(10,30,50,0.3)");

        // Pillars: glossy gradient columns with a lip at the gap.
        const pw = PIPE_W * k;
        for (const p of s.pipes) {
          const x = sx(p.x);
          if (x > W + pw || x < -pw) continue;
          const g = ctx.createLinearGradient(x, 0, x + pw, 0);
          g.addColorStop(0, PILLAR[2]);
          g.addColorStop(0.45, PILLAR[1]);
          g.addColorStop(1, PILLAR[0]);
          const topEnd = sy(p.gapY - p.gap / 2);
          const botStart = sy(p.gapY + p.gap / 2);
          ctx.save();
          ctx.shadowColor = "rgba(120,255,214,0.35)";
          ctx.shadowBlur = 18;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.rect(x, -20, pw, topEnd + 20);
          ctx.rect(x, botStart, pw, sy(H) - botStart);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillRect(x + pw * 0.16, -20, pw * 0.09, topEnd + 20);
          ctx.fillRect(x + pw * 0.16, botStart, pw * 0.09, sy(H) - botStart);
          // Caps at the gap: wider, same gradient, lit top edge.
          const cap = Math.max(10, pw * 0.22);
          for (const cy of [topEnd - cap, botStart]) {
            const cg = ctx.createLinearGradient(x - 4, 0, x + pw + 4, 0);
            cg.addColorStop(0, PILLAR[2]);
            cg.addColorStop(0.45, "#c9fff0");
            cg.addColorStop(1, PILLAR[0]);
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.roundRect(x - 4, cy, pw + 8, cap, cap * 0.45);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Ground line.
        const gy = sy(H);
        const gg = ctx.createLinearGradient(0, gy, W, gy);
        gg.addColorStop(0, PILLAR[0]);
        gg.addColorStop(1, PILLAR[2]);
        ctx.fillStyle = "rgba(4,10,20,0.7)";
        ctx.fillRect(0, gy, W, SH - gy);
        ctx.fillStyle = gg;
        ctx.fillRect(0, gy, W, 2);

        // Puffs.
        for (const p of puffs) {
          ctx.globalAlpha = p.life * 0.5;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(sx(p.x) - (1 - p.life) * 14, sy(p.y), (1 - p.life) * 9 + 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Bird: glowing orb tilted by velocity, with a beating wing.
        const r = R * k;
        const tilt = s.started ? Math.max(-0.5, Math.min(1.2, s.vy / 110)) : 0;
        ctx.save();
        ctx.translate(birdX, sy(by));
        ctx.rotate(tilt);
        const body = ctx.createLinearGradient(-r, -r, r, r);
        body.addColorStop(0, BIRD[0]);
        body.addColorStop(0.5, BIRD[1]);
        body.addColorStop(1, BIRD[2]);
        ctx.shadowColor = BIRD[2];
        ctx.shadowBlur = r * 1.6;
        ctx.fillStyle = s.alive ? body : "#8a8aa0";
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        const beat = reducedMotion ? 0 : Math.max(0, 1 - wing * 4) * Math.sin(wing * 40);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.ellipse(-r * 0.25, r * 0.1, r * 0.55, r * (0.28 + 0.25 * beat), -0.4 - beat * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a0b2e";
        ctx.beginPath();
        ctx.arc(r * 0.42, -r * 0.25, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffb347";
        ctx.beginPath();
        ctx.moveTo(r * 0.85, -r * 0.05);
        ctx.lineTo(r * 1.35, r * 0.12);
        ctx.lineTo(r * 0.85, r * 0.3);
        ctx.fill();
        ctx.restore();

        if (!s.started && s.alive) {
          ctx.font = "600 15px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(255,255,255,${reducedMotion ? 0.8 : 0.55 + 0.3 * Math.sin(s.t * 4)})`;
          ctx.fillText("Tap to flap", birdX, sy(by) + r + 34);
        }
        ctx.restore();
      },

      serialize: () => s,
      restore(data) {
        s = data as FlutterState;
        puffs = [];
      },
      destroy: off,
    };
  },
};

export default flutter;
