import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { LANE_W, createRunnerView, mat, mesh } from "../runner-view";
import { COIN, LOOK, jump, newGame, roll, steer, step, type DashState } from "./logic";

const TRAIN_COLORS = [0xff4d8d, 0x22d3ee, 0xa78bfa, 0xfbbf24];
const SEG = 20;

const railDash: GameModule = {
  kind: "3d",
  create({ stage, input, rng, emit, reducedMotion }) {
    let s: DashState = newGame();
    let crashed = false;
    const box = new THREE.BoxGeometry(1, 1, 1);

    const view = createRunnerView(
      stage,
      {
        sky: "linear-gradient(180deg, #0b1033 0%, #2a1458 45%, #7a1f5c 75%, #ff7a59 100%)",
        fog: 0x2a1650,
        body: 0x22d3ee,
        accent: 0xff4d8d,
        model(o) {
          const g = new THREE.Group();
          if (o.look === LOOK.train) {
            const c = TRAIN_COLORS[o.id % TRAIN_COLORS.length];
            const car = mesh(box, mat(c, { roughness: 0.3, metalness: 0.2 }));
            car.scale.set(1.9, 2.6, o.len - 0.3);
            car.position.y = 1.4;
            const stripe = mesh(box, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 }), false);
            stripe.scale.set(1.94, 0.12, o.len - 0.4);
            stripe.position.y = 1.9;
            const win = mesh(box, mat(0x0b1020, { emissive: 0x7dd3fc, emissiveIntensity: 0.35 }), false);
            win.scale.set(1.5, 0.8, 0.05);
            win.position.set(0, 2.1, -o.len / 2 + 0.12);
            g.add(car, stripe, win);
          } else if (o.look === LOOK.low || o.look === LOOK.high) {
            const y = o.look === LOOK.low ? 0.6 : 1.75;
            const bar = mesh(box, mat(o.look === LOOK.low ? 0xfbbf24 : 0xff4d8d, { emissive: o.look === LOOK.low ? 0xb45309 : 0x9d174d, emissiveIntensity: 0.4 }));
            bar.scale.set(1.9, 0.32, 0.25);
            bar.position.y = y;
            g.add(bar);
            for (const sx of [-0.9, 0.9]) {
              const post = mesh(box, mat(0xe5e7eb));
              post.scale.set(0.14, y + 0.2, 0.14);
              post.position.set(sx, (y + 0.2) / 2, 0);
              g.add(post);
            }
          } else {
            const crate = mesh(box, mat(0x8b5cf6, { roughness: 0.5 }));
            crate.scale.set(1.5, 1.5, 1.2);
            crate.position.y = 0.75;
            const band = mesh(box, mat(0xfde047, { emissive: 0xfde047, emissiveIntensity: 0.3 }), false);
            band.scale.set(1.54, 0.16, 1.24);
            band.position.y = 0.75;
            g.add(crate, band);
          }
          return g;
        },
        pickup(p) {
          if (p.kind === COIN) {
            const coin = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 24), mat(0xfcd34d, { metalness: 0.6, roughness: 0.25, emissive: 0xb45309, emissiveIntensity: 0.5 }), false);
            coin.rotation.z = Math.PI / 2;
            const g = new THREE.Group();
            g.add(coin);
            return g;
          }
          const g = new THREE.Group();
          const u = mesh(new THREE.TorusGeometry(0.4, 0.13, 10, 24, Math.PI), mat(0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.6 }), false);
          u.rotation.z = Math.PI;
          g.add(u);
          return g;
        },
        ground(scene) {
          const segs: THREE.Group[] = [];
          const gravel = mat(0x231a3d, { roughness: 0.95 });
          const rail = mat(0xcbd5e1, { metalness: 0.7, roughness: 0.3 });
          const sleeper = mat(0x3b2f55);
          const neon = [0xff4d8d, 0x22d3ee];
          for (let i = 0; i < 9; i++) {
            const g = new THREE.Group();
            const bed = mesh(box, gravel, false);
            bed.scale.set(LANE_W * 3 + 1.4, 0.2, SEG);
            bed.position.y = -0.1;
            g.add(bed);
            for (const l of [-1, 0, 1]) {
              for (const off of [-0.55, 0.55]) {
                const r = mesh(box, rail, false);
                r.scale.set(0.08, 0.12, SEG);
                r.position.set(l * LANE_W + off, 0.06, 0);
                g.add(r);
              }
              for (let k = 0; k < SEG; k += 2) {
                const sl = mesh(box, sleeper, false);
                sl.scale.set(1.6, 0.06, 0.3);
                sl.position.set(l * LANE_W, 0.02, k - SEG / 2);
                g.add(sl);
              }
            }
            for (const side of [-1, 1]) {
              const wall = mesh(box, mat(0x161032), false);
              wall.scale.set(0.6, 3 + (i % 3), SEG);
              wall.position.set(side * (LANE_W * 1.5 + 2), (3 + (i % 3)) / 2, 0);
              const strip = mesh(box, mat(neon[(i + (side > 0 ? 1 : 0)) % 2], { emissive: neon[(i + (side > 0 ? 1 : 0)) % 2], emissiveIntensity: 1.2 }), false);
              strip.scale.set(0.62, 0.1, SEG);
              strip.position.set(side * (LANE_W * 1.5 + 2), 2.2, 0);
              g.add(wall, strip);
            }
            scene.add(g);
            segs.push(g);
          }
          return {
            update(z) {
              const base = Math.floor(z / SEG) * SEG - SEG;
              segs.forEach((g, i) => g.position.set(0, 0, base + i * SEG + SEG / 2));
            },
          };
        },
      },
      reducedMotion,
    );

    const off = input.on((e) => {
      if (!s.r.alive) return;
      if (e.type === "swipe") {
        if (e.dir === "left") steer(s.r, -1);
        else if (e.dir === "right") steer(s.r, 1);
        else if (e.dir === "up") jump(s.r);
        else roll(s.r);
      } else if (e.type === "tap") jump(s.r);
      else if (e.type === "action") {
        if (e.action === "left") steer(s.r, -1);
        else if (e.action === "right") steer(s.r, 1);
        else if (e.action === "up" || e.action === "primary") jump(s.r);
        else if (e.action === "down") roll(s.r);
      }
    });

    let lastDt = 1 / 60;
    return {
      update(dt) {
        lastDt = dt;
        const score = s.score;
        const ev = step(s, dt, rng);
        if (s.score !== score) emit({ type: "score", value: s.score });
        if (ev.includes("crash")) {
          crashed = true;
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.score });
        } else if (ev.includes("magnet")) emit({ type: "feel", kind: "success" });
        else if (ev.includes("coin")) emit({ type: "feel", kind: "score" });
      },
      render() {
        view.render(s.r, lastDt, crashed);
      },
      serialize: () => s,
      restore(data) {
        s = data as DashState;
        crashed = !s.r.alive;
      },
      destroy() {
        off();
        view.destroy();
      },
    };
  },
};

export default railDash;
