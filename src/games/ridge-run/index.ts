import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { LANE_W, createRunnerView, mat, mesh } from "../runner-view";
import { LOOK, bend, jump, newGame, roll, steer, step, type RidgeState } from "./logic";

const SEG = 3;
const N = 56;

const ridgeRun: GameModule = {
  kind: "3d",
  create({ stage, input, rng, emit, reducedMotion }) {
    let s: RidgeState = newGame();
    let crashed = false;

    const view = createRunnerView(
      stage,
      {
        sky: "linear-gradient(180deg, #2b1055 0%, #7b2f7f 35%, #f76b1c 70%, #fbd786 100%)",
        fog: 0xc0566b,
        path: bend,
        body: 0xf97316,
        accent: 0xfacc15,
        model(o) {
          const g = new THREE.Group();
          if (o.look === LOOK.rock) {
            const r = mesh(new THREE.DodecahedronGeometry(0.95, 0), mat(0x6b4f7a, { roughness: 0.9, flatShading: true }));
            r.position.y = 0.75;
            r.rotation.set(o.id, o.id * 2, 0);
            g.add(r);
          } else if (o.look === LOOK.log) {
            const l = mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.9, 12), mat(0x8b5a2b, { roughness: 0.8 }));
            l.rotation.z = Math.PI / 2;
            l.position.y = 0.34;
            g.add(l);
          } else if (o.look === LOOK.branch) {
            const b = mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.4, 10), mat(0x6b3f1d));
            b.rotation.z = Math.PI / 2;
            b.position.y = 1.75;
            g.add(b);
            for (let i = 0; i < 4; i++) {
              const leaf = mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(i % 2 ? 0x22c55e : 0x84cc16, { flatShading: true }));
              leaf.position.set(-0.9 + i * 0.6, 2.05 + (i % 2) * 0.15, 0);
              g.add(leaf);
            }
            for (const sx of [-1.15, 1.15]) {
              const post = mesh(new THREE.CylinderGeometry(0.12, 0.15, 2, 8), mat(0x6b3f1d));
              post.position.set(sx, 1, 0);
              g.add(post);
            }
          }
          return g; // gaps are drawn by the ground (it leaves a hole)
        },
        pickup() {
          const g = new THREE.Group();
          g.add(mesh(new THREE.OctahedronGeometry(0.36, 0), mat(0x5eead4, { emissive: 0x14b8a6, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true }), false));
          return g;
        },
        ground(scene, path) {
          const box = new THREE.BoxGeometry(1, 1, 1);
          const top = mat(0xe8a87c, { roughness: 0.85 });
          const edge = mat(0xb5654f, { roughness: 0.9 });
          const cliff = mat(0x5b2a5e, { roughness: 1 });
          const segs: THREE.Group[] = [];
          for (let i = 0; i < N; i++) {
            const g = new THREE.Group();
            const t = mesh(box, top, false);
            t.scale.set(LANE_W * 3 + 0.8, 0.4, SEG + 0.05);
            t.position.y = -0.2;
            const rock = mesh(box, cliff, false);
            rock.scale.set(LANE_W * 3 + 0.4, 8, SEG + 0.05);
            rock.position.y = -4.4;
            g.add(t, rock);
            for (const side of [-1, 1]) {
              const e = mesh(box, edge, false);
              e.scale.set(0.35, 0.3, SEG + 0.05);
              e.position.set(side * (LANE_W * 1.5 + 0.55), 0.05, 0);
              g.add(e);
            }
            scene.add(g);
            segs.push(g);
          }
          // Distant peaks on both sides for depth.
          const peaks: THREE.Mesh[] = [];
          const peakMat = [mat(0x3b1d5a, { flatShading: true }), mat(0x6d2f6b, { flatShading: true })];
          for (let i = 0; i < 22; i++) {
            const p = mesh(new THREE.ConeGeometry(6 + (i % 4) * 2, 14 + (i % 5) * 4, 5), peakMat[i % 2], false);
            scene.add(p);
            peaks.push(p);
          }
          return {
            update(z, st) {
              const base = Math.floor(z / SEG) * SEG - SEG * 4;
              segs.forEach((g, i) => {
                const zc = base + i * SEG + SEG / 2;
                const p = path(zc);
                g.position.set(p.x, p.y, zc);
                g.rotation.set(-Math.atan2(path(zc + 1).y - path(zc - 1).y, 2), Math.atan2(path(zc + 1).x - path(zc - 1).x, 2), 0, "YXZ");
                g.visible = !st.obstacles.some((o) => o.kind === "gap" && zc > o.z && zc < o.z + o.len);
              });
              const pb = Math.floor(z / 14) * 14;
              peaks.forEach((m, i) => {
                const zc = pb + Math.floor(i / 2) * 14 - 10;
                const side = i % 2 ? 1 : -1;
                const p = path(zc);
                m.position.set(p.x + side * (22 + ((zc * 7) % 9)), p.y - 6, zc + 20);
              });
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
        } else if (ev.includes("gem")) emit({ type: "feel", kind: "score" });
      },
      render() {
        view.render(s.r, lastDt, crashed);
      },
      serialize: () => s,
      restore(data) {
        s = data as RidgeState;
        crashed = !s.r.alive;
      },
      destroy() {
        off();
        view.destroy();
      },
    };
  },
};

export default ridgeRun;
