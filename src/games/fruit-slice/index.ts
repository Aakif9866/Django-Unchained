import { fitWorld } from "@/engine/stage";
import type { GameModule } from "@/engine/types";
import { H, LIVES, W, newGame, slice, step, type FruitState, type Item } from "./logic";

// skin light, skin dark, flesh
const FRUIT: [string, string, string][] = [
  ["#4ade80", "#166534", "#fb7185"],
  ["#fdba74", "#ea580c", "#fed7aa"],
  ["#d8b4fe", "#7e22ce", "#f5d0fe"],
  ["#d9f99d", "#4d7c0f", "#ecfccb"],
  ["#f9a8d4", "#be185d", "#fff1f2"],
  ["#fef08a", "#ca8a04", "#fef9c3"],
];
interface Half {
  it: Item;
  angle: number;
  side: 1 | -1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}
interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: string;
  t: number;
}

const fruitSlice: GameModule = {
  kind: "2d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { ctx } = stage;
    let s: FruitState = newGame();
    let F = fitWorld(stage, insets(), W, H, 0);
    let halves: Half[] = [];
    let drops: Drop[] = [];
    let trail: { x: number; y: number; t: number }[] = [];
    let clock = 0;
    let swipe = 0;
    let last: { x: number; y: number } | null = null;
    let popText: { x: number; y: number; t: number; text: string }[] = [];

    const world = (x: number, y: number) => ({ x: (x - F.x) / F.k, y: (y - F.y) / F.k });

    const off = input.on((e) => {
      if (e.type !== "drag") return;
      if (e.phase === "start") {
        swipe++;
        last = world(e.x, e.y);
        trail = [{ x: e.x, y: e.y, t: clock }];
        return;
      }
      if (e.phase === "end" || !last) {
        last = null;
        return;
      }
      const p = world(e.x, e.y);
      trail.push({ x: e.x, y: e.y, t: clock });
      const r = slice(s, last.x, last.y, p.x, p.y, swipe);
      last = p;
      if (r.bomb) {
        emit({ type: "feel", kind: "fail" });
        emit({ type: "over", score: s.score });
        return;
      }
      for (const c of r.cuts) {
        const nx = -Math.sin(c.angle);
        const ny = Math.cos(c.angle);
        for (const side of [1, -1] as const)
          halves.push({ it: c.item, angle: c.angle, side, x: c.item.x, y: c.item.y, vx: c.item.vx + nx * side * 18, vy: c.item.vy + ny * side * 18, t: 1.4 });
        if (!reducedMotion)
          for (let i = 0; i < 12; i++) {
            const a = rng.next() * Math.PI * 2;
            const sp = 10 + rng.next() * 35;
            drops.push({ x: c.item.x, y: c.item.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, c: FRUIT[c.item.kind][2], t: 0.6 });
          }
      }
      if (r.cuts.length) {
        emit({ type: "score", value: s.score });
        emit({ type: "feel", kind: r.bonus ? "success" : "score" });
      }
      if (r.bonus) popText.push({ x: p.x, y: p.y, t: 0.9, text: `Combo +${r.bonus}` });
    });

    function drawFruit(it: Item, x: number, y: number, a: number, half?: { angle: number; side: 1 | -1 }) {
      const r = it.r * F.k;
      ctx.save();
      ctx.translate(x, y);
      if (half) {
        // Keep the half on one side of the cut line, flesh facing the cut.
        ctx.rotate(half.angle + (half.side < 0 ? Math.PI : 0) + (a - it.a) * 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI);
        ctx.closePath();
        ctx.clip();
      } else ctx.rotate(a);
      if (it.kind < 0) {
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
        g.addColorStop(0, "#4b5563");
        g.addColorStop(1, "#0b0b10");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        // Fuse spark (not rotated).
        const fx = x + Math.cos(a - 1.2) * r;
        const fy = y + Math.sin(a - 1.2) * r;
        ctx.save();
        ctx.shadowColor = "#f97316";
        ctx.shadowBlur = 16;
        ctx.fillStyle = reducedMotion || Math.floor(clock * 12) % 2 ? "#fde047" : "#f97316";
        ctx.beginPath();
        ctx.arc(fx, fy, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      const [c0, c1, flesh] = FRUIT[it.kind];
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (half) {
        ctx.fillStyle = flesh;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.ellipse(Math.cos((i / 4) * Math.PI) * r * 0.45, Math.sin((i / 4) * Math.PI) * r * 0.45 + 1, r * 0.06, r * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.ellipse(r * 0.15, -r * 1.02, r * 0.32, r * 0.14, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    return {
      update(dt) {
        clock += dt;
        halves = halves
          .map((h) => ({ ...h, x: h.x + h.vx * dt, y: h.y + h.vy * dt, vy: h.vy + 95 * dt, t: h.t - dt }))
          .filter((h) => h.t > 0 && h.y < H + 20);
        drops = drops.map((d) => ({ ...d, x: d.x + d.vx * dt, y: d.y + d.vy * dt, vy: d.vy + 60 * dt, t: d.t - dt })).filter((d) => d.t > 0);
        popText = popText.map((p) => ({ ...p, y: p.y - 12 * dt, t: p.t - dt })).filter((p) => p.t > 0);
        trail = trail.filter((p) => clock - p.t < 0.16);
        if (!s.alive) return;
        const ev = step(s, dt, rng);
        if (ev.includes("dead")) {
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.score });
        } else if (ev.includes("miss")) emit({ type: "feel", kind: "fail" });
      },

      render() {
        F = fitWorld(stage, insets(), W, H, 0);
        const { k } = F;
        const SW = stage.width;
        const SHh = stage.height;
        ctx.clearRect(0, 0, SW, SHh);
        const bg = ctx.createLinearGradient(0, 0, SW, SHh);
        bg.addColorStop(0, "#1a0b2e");
        bg.addColorStop(0.5, "#0f172a");
        bg.addColorStop(1, "#052e2b");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, SW, SHh);
        const glow = ctx.createRadialGradient(SW / 2, SHh * 0.45, 0, SW / 2, SHh * 0.45, SHh * 0.6);
        glow.addColorStop(0, "rgba(251,113,133,0.16)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, SW, SHh);

        const X = (x: number) => F.x + x * k;
        const Y = (y: number) => F.y + y * k;
        for (const d of drops) {
          ctx.globalAlpha = d.t / 0.6;
          ctx.fillStyle = d.c;
          ctx.beginPath();
          ctx.arc(X(d.x), Y(d.y), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (const h of halves) drawFruit(h.it, X(h.x), Y(h.y), h.it.a + (1.4 - h.t) * h.it.spin, h);
        for (const it of s.items) {
          ctx.save();
          ctx.shadowColor = it.kind < 0 ? "#ef4444" : FRUIT[it.kind][0];
          ctx.shadowBlur = 22;
          drawFruit(it, X(it.x), Y(it.y), it.a);
          ctx.restore();
        }

        // Blade trail: tapered, glowing.
        if (trail.length > 1) {
          ctx.save();
          ctx.lineCap = "round";
          ctx.shadowColor = "#67e8f9";
          ctx.shadowBlur = 14;
          for (let i = 1; i < trail.length; i++) {
            const f = i / trail.length;
            ctx.strokeStyle = `rgba(236,254,255,${0.3 + f * 0.7})`;
            ctx.lineWidth = 1 + f * 6;
            ctx.beginPath();
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.textAlign = "center";
        for (const p of popText) {
          ctx.globalAlpha = Math.min(1, p.t * 2);
          ctx.font = "800 18px system-ui, sans-serif";
          ctx.fillStyle = "#fde047";
          ctx.fillText(p.text, X(p.x), Y(p.y));
        }
        ctx.globalAlpha = 1;

        // Lives: crosses fill in as fruit is missed.
        const ins = insets();
        for (let i = 0; i < LIVES; i++) {
          const lost = i >= s.lives;
          const cx = SW - 24 - i * 26;
          const cy = ins.top + 18;
          ctx.strokeStyle = lost ? "#fb7185" : "rgba(255,255,255,0.25)";
          ctx.lineWidth = 3.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(cx - 7, cy - 7);
          ctx.lineTo(cx + 7, cy + 7);
          ctx.moveTo(cx + 7, cy - 7);
          ctx.lineTo(cx - 7, cy + 7);
          ctx.stroke();
        }
        if (s.t < 3 && s.alive) {
          ctx.font = "600 15px system-ui, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fillText("Swipe to slice · Avoid the bombs", SW / 2, SHh * 0.55);
        }
      },

      serialize: () => s,
      restore(data) {
        s = data as FruitState;
        halves = [];
        drops = [];
        trail = [];
        last = null;
      },
      destroy: off,
    };
  },
};

export default fruitSlice;
