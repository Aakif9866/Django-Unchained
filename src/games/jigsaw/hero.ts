/**
 * Original superhero art, drawn in code from a seed at 1920 × 1080. Same seed, same picture, so a saved run redraws
 * the same hero. Seeds 1..9999 mix sky, city, pose, build, costume, cape, mask and emblem into thousands of heroes.
 */
import { createRng, type Rng } from "@/engine/rng";

export const W = 1920, H = 1080;

const PRE = ["Captain", "Doctor", "Lady", "Major", "Night", "Iron", "Star", "Storm", "Volt", "Nova", "Shadow", "Crimson",
  "Silver", "Solar", "Thunder", "Mystic", "Quantum", "Blaze", "Frost", "Turbo", "Cosmic", "Ember", "Neon", "Atomic"];
const POST = ["Warden", "Falcon", "Comet", "Spark", "Ranger", "Sentinel", "Fury", "Lynx", "Bolt", "Phoenix", "Titan",
  "Wraith", "Vector", "Pulse", "Raven", "Viper", "Arrow", "Nimbus", "Flare", "Echo", "Aegis", "Orbit", "Tempest", "Valor"];

/** Sky themes: top, middle, horizon, celestial body, haze. */
const SKIES = [
  ["#0b1026", "#3b1d5e", "#f0627a", "#ffd27a", "#ff9a8b"], // dusk
  ["#020617", "#0f1e4a", "#1e4b8f", "#e8f0ff", "#5b7fd1"], // night
  ["#1a2a6c", "#b21f1f", "#fdbb2d", "#fff3c4", "#ffb35c"], // blaze
  ["#0f2027", "#203a43", "#2c7a7b", "#c6fff4", "#5fd3c5"], // storm teal
  ["#2b0a3d", "#7b2ff7", "#f107a3", "#ffe1fa", "#ff7ad9"], // neon
  ["#13293d", "#006494", "#78c0e0", "#fffbe6", "#bfe6ff"], // dawn
];

const hsl = (h: number, s: number, l: number) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;

export function heroName(seed: number) {
  const r = createRng(seed * 7919);
  return `${r.pick(PRE)} ${r.pick(POST)}`;
}

function skyline(ctx: CanvasRenderingContext2D, r: Rng, base: number, maxH: number, fill: string, windows: string | null) {
  let x = -40;
  while (x < W + 40) {
    const w = 70 + r.next() * 150, h = maxH * (0.35 + r.next() * 0.65);
    ctx.fillStyle = fill;
    ctx.fillRect(x, base - h, w, h + 4);
    if (r.next() < 0.3) ctx.fillRect(x + w * 0.4, base - h - 40, 6, 40); // antenna
    if (r.next() < 0.25) ctx.fillRect(x + w * 0.15, base - h - 22, w * 0.7, 22); // stepped top
    if (windows)
      for (let wy = base - h + 18; wy < base - 14; wy += 26)
        for (let wx = x + 12; wx < x + w - 14; wx += 22)
          if (r.next() < 0.32) {
            ctx.fillStyle = windows;
            ctx.globalAlpha = 0.35 + r.next() * 0.6;
            ctx.fillRect(wx, wy, 9, 13);
            ctx.globalAlpha = 1;
          }
    x += w + r.next() * 8;
  }
}

function emblem(ctx: CanvasRenderingContext2D, kind: number, s: number) {
  ctx.beginPath();
  const star = (n: number, ro: number, ri: number) => {
    for (let k = 0; k < n * 2; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / n, rr = k % 2 ? ri : ro;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  switch (kind) {
    case 0: star(5, s, s * 0.42); break;
    case 1: ctx.moveTo(s * 0.2, -s); ctx.lineTo(-s * 0.5, s * 0.1); ctx.lineTo(0, s * 0.1); ctx.lineTo(-s * 0.2, s); ctx.lineTo(s * 0.5, -s * 0.15); ctx.lineTo(0, -s * 0.15); ctx.closePath(); break; // bolt
    case 2: ctx.moveTo(-s, -s * 0.5); ctx.lineTo(0, s * 0.2); ctx.lineTo(s, -s * 0.5); ctx.lineTo(s, 0); ctx.lineTo(0, s * 0.75); ctx.lineTo(-s, 0); ctx.closePath(); break; // chevron
    case 3: ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2, true); break; // ring
    case 4: ctx.moveTo(0, -s * 0.3); for (const d of [-1, 1]) { ctx.moveTo(0, -s * 0.2); ctx.quadraticCurveTo(d * s * 0.6, -s, d * s * 1.1, -s * 0.5); ctx.quadraticCurveTo(d * s * 0.6, -s * 0.2, d * s * 0.9, s * 0.1); ctx.quadraticCurveTo(d * s * 0.4, 0, 0, s * 0.6); } break; // wings
    case 5: ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.6, s, 0, s); ctx.bezierCurveTo(-s * 0.6, s, -s * 0.9, -s * 0.2, -s * 0.15, -s * 0.35); ctx.quadraticCurveTo(-s * 0.1, s * 0.2, s * 0.1, s * 0.3); ctx.closePath(); break; // flame
    case 6: ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, 0); ctx.closePath(); break; // diamond
    case 7: star(4, s, s * 0.3); break; // spark
    case 8: ctx.moveTo(0, -s); ctx.lineTo(s * 0.9, -s * 0.55); ctx.lineTo(s * 0.75, s * 0.35); ctx.lineTo(0, s); ctx.lineTo(-s * 0.75, s * 0.35); ctx.lineTo(-s * 0.9, -s * 0.55); ctx.closePath(); break; // shield
    case 9: ctx.arc(0, 0, s * 0.8, Math.PI * 0.3, Math.PI * 1.7); ctx.arc(s * 0.35, 0, s * 0.6, Math.PI * 1.6, Math.PI * 0.4, true); ctx.closePath(); break; // crescent
    case 10: star(6, s, s * 0.55); break; // sun
    default: ctx.moveTo(-s, s * 0.6); ctx.lineTo(0, -s); ctx.lineTo(s, s * 0.6); ctx.lineTo(s * 0.45, s * 0.6); ctx.lineTo(0, -s * 0.15); ctx.lineTo(-s * 0.45, s * 0.6); ctx.closePath(); // peak
  }
  ctx.fill("evenodd");
}

/** A tapered limb from (x0,y0) to (x1,y1), w0 → w1 wide, with a rounded joint. */
function limb(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, a - Math.PI / 2, a + Math.PI / 2, true);
  ctx.fill();
}

export function drawHero(seed: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  const r = createRng(seed);
  const sky = SKIES[seed % SKIES.length];

  // Sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sky[0]);
  g.addColorStop(0.55, sky[1]);
  g.addColorStop(1, sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 160; k++) {
    ctx.fillStyle = `rgba(255,255,255,${r.next() * 0.7})`;
    ctx.fillRect(r.next() * W, r.next() * H * 0.55, 2, 2);
  }

  // Sun or moon, opposite side to the hero
  const heroX = W * (0.36 + r.next() * 0.28);
  const sunX = heroX < W / 2 ? W * (0.68 + r.next() * 0.2) : W * (0.12 + r.next() * 0.2), sunY = H * (0.2 + r.next() * 0.2);
  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 420);
  halo.addColorStop(0, sky[3]);
  halo.addColorStop(0.18, sky[3]);
  halo.addColorStop(0.2, sky[4] + "aa");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // Rays behind the hero
  ctx.save();
  ctx.translate(heroX, H * 0.48);
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + r.next() * 0.1;
    ctx.fillStyle = `rgba(255,255,255,${0.025 + r.next() * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 1600, a, a + 0.07 + r.next() * 0.06);
    ctx.fill();
  }
  ctx.restore();

  // City: hazy far layer, darker near layer with lit windows
  const horizon = H * 0.86;
  ctx.globalAlpha = 0.55;
  skyline(ctx, r, horizon, 420, sky[1], null);
  ctx.globalAlpha = 1;
  const haze = ctx.createLinearGradient(0, horizon - 300, 0, horizon);
  haze.addColorStop(0, "rgba(0,0,0,0)");
  haze.addColorStop(1, sky[4] + "66");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 300, W, 300);
  skyline(ctx, r, H, 360, "#0a0b16", "#ffd98a");

  // Costume palette
  const hue = r.int(0, 359);
  const scheme = r.int(0, 2); // complementary, triad, analogous
  const hue2 = hue + [180, 120, 40][scheme];
  const suit = hsl(hue, 70 + r.int(0, 20), 42 + r.int(0, 10));
  const suitDark = hsl(hue, 70, 24);
  const trim = hsl(hue2, 85, 55);
  const cape = r.next() < 0.5 ? hsl(hue2, 75, 38) : hsl(hue + 10, 80, 30);
  const capeIn = hsl(hue2 + 20, 70, 22);
  const skin = ["#f1c7a4", "#d9a07a", "#b97a56", "#8d5a3b", "#5e3a26"][r.int(0, 4)];
  const hair = ["#1b1b1f", "#3b2414", "#7a4a1e", "#d8b25a", "#c0c4cc", "#8b1e2d"][r.int(0, 5)];
  const flying = r.next() < 0.4;
  const build = 0.9 + r.next() * 0.25;
  const emb = r.int(0, 11);
  const helmet = r.next() < 0.3;
  const S = (flying ? 0.95 : 1.05) * (H / 1080);

  // Rooftop ledge
  if (!flying) {
    ctx.fillStyle = "#07070d";
    ctx.beginPath();
    ctx.moveTo(heroX - 520, H);
    ctx.lineTo(heroX - 470, H - 70);
    ctx.lineTo(heroX + 470, H - 70);
    ctx.lineTo(heroX + 520, H);
    ctx.fill();
    ctx.fillStyle = sky[4] + "55";
    ctx.fillRect(heroX - 470, H - 70, 940, 4);
  }

  ctx.save();
  ctx.translate(heroX, flying ? H * 0.6 : H - 70);
  ctx.scale(S * (r.next() < 0.5 ? 1 : -1), S); // face either way
  if (flying) ctx.rotate(-0.42);
  const sw = 115 * build; // half shoulder width
  const wind = flying ? 1.6 : 1;

  // Glow behind the figure
  const aura = ctx.createRadialGradient(0, -420, 40, 0, -420, 560);
  aura.addColorStop(0, sky[4] + "66");
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(-700, -1000, 1400, 1100);

  // Cape
  const capeG = ctx.createLinearGradient(-sw, -480, sw * 2.5, 0);
  capeG.addColorStop(0, cape);
  capeG.addColorStop(1, capeIn);
  ctx.fillStyle = capeG;
  ctx.beginPath();
  ctx.moveTo(-sw * 0.9, -500);
  ctx.bezierCurveTo(-sw * 1.8, -300, -sw * 2.6 * wind, -80, -sw * 3.2 * wind, 40);
  for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(-sw * (2.7 - k * 0.55) * wind, -20 + (k % 2) * 50, -sw * (2.4 - k * 0.6) * wind, 30 - (k % 2) * 30);
  ctx.bezierCurveTo(-sw * 0.2, -40, sw * 0.4, -300, sw * 0.9, -500);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 6;
  ctx.stroke();

  // Legs and boots
  const legG = ctx.createLinearGradient(-80, 0, 80, 0);
  legG.addColorStop(0, suit);
  legG.addColorStop(1, suitDark);
  ctx.fillStyle = legG;
  const stance = flying ? [[-40, 20], [60, -20]] : [[-95, 0], [95, 0]];
  for (const [fx, fy] of stance) limb(ctx, Math.sign(fx) * 45, -260, fx, fy - 30, 92 * build, 58);
  ctx.fillStyle = trim;
  for (const [fx, fy] of stance) limb(ctx, fx * 0.92, fy - 120, fx, fy - 18, 62, 64);

  // Torso
  const torso = ctx.createLinearGradient(-sw, -500, sw, -250);
  torso.addColorStop(0, suit);
  torso.addColorStop(0.6, suit);
  torso.addColorStop(1, suitDark);
  ctx.fillStyle = torso;
  ctx.beginPath();
  ctx.moveTo(-sw, -490);
  ctx.quadraticCurveTo(0, -520, sw, -490);
  ctx.quadraticCurveTo(sw * 0.95, -380, 62 * build, -250);
  ctx.lineTo(-62 * build, -250);
  ctx.quadraticCurveTo(-sw * 0.95, -380, -sw, -490);
  ctx.fill();
  // Abs hint
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -360);
  ctx.lineTo(0, -270);
  ctx.stroke();
  // Belt
  ctx.fillStyle = trim;
  ctx.fillRect(-66 * build, -275, 132 * build, 28);
  ctx.fillStyle = "#ffe08a";
  ctx.fillRect(-16, -279, 32, 36);

  // Arms: fists on hips standing, one fist up flying
  ctx.fillStyle = suit;
  const arms = flying
    ? [[-sw, -470, -sw - 60, -620, -sw - 40, -760], [sw, -470, sw + 110, -380, sw + 90, -270]]
    : [[-sw, -470, -sw - 75, -350, -70 * build, -275], [sw, -470, sw + 75, -350, 70 * build, -275]];
  for (const [sx, sy, ex, ey, hx, hy] of arms) {
    limb(ctx, sx, sy, ex, ey, 66 * build, 52);
    limb(ctx, ex, ey, hx, hy, 52, 44);
  }
  ctx.fillStyle = trim;
  for (const [, , ex, ey, hx, hy] of arms) {
    limb(ctx, ex + (hx - ex) * 0.45, ey + (hy - ey) * 0.45, hx, hy, 50, 54);
    ctx.beginPath();
    ctx.arc(hx, hy, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // Emblem badge
  ctx.save();
  ctx.translate(0, -410);
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff6d8";
  emblem(ctx, emb, 40);
  ctx.restore();

  // Neck and head
  ctx.fillStyle = skin;
  ctx.fillRect(-26, -540, 52, 50);
  ctx.beginPath();
  ctx.ellipse(0, -600, 56, 68, 0, 0, Math.PI * 2);
  ctx.fill();
  if (helmet) {
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.ellipse(0, -612, 62, 70, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(62, -590);
    ctx.lineTo(-62, -590);
    ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(-6, -684, 12, 70);
  } else {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(0, -636, 60, 40, 0, Math.PI, Math.PI * 2);
    ctx.quadraticCurveTo(70, -600, 50, -585);
    ctx.lineTo(-56, -610);
    ctx.fill();
  }
  // Mask with eye slits
  ctx.fillStyle = suitDark;
  ctx.beginPath();
  ctx.roundRect(-60, -618, 120, 34, 16);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(d * 24, -601, 13, 7, d * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Jaw shadow
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.ellipse(10, -565, 40, 22, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // Rim light and vignette
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  return cv;
}
