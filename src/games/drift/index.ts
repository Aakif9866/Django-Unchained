import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { BARRIER, LAPS, SAMPLES, TRACK, WIDTH, ghostAt, newGame, step, type DriftState } from "./logic";

const GHOST_KEY = "onhold:drift-ghost";
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;

function loadGhost(): { ghost: number[]; bestLap: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(GHOST_KEY) ?? "null");
    return v && Array.isArray(v.ghost) && typeof v.bestLap === "number" ? v : null;
  } catch {
    return null;
  }
}

const drift: GameModule = {
  kind: "3d",
  create({ stage, input, emit, insets, reducedMotion }) {
    const { scene, renderer, key } = stage;
    const saved = loadGhost();
    let s: DriftState = newGame(saved?.ghost ?? null, saved?.bestLap ?? null);
    stage.host.style.background = "linear-gradient(180deg, #0f0c29 0%, #302b63 55%, #24243e 100%)";
    scene.fog = new THREE.Fog(0x1d1a46, 60, 170);
    const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });

    const info = document.createElement("div");
    info.style.cssText =
      "position:absolute;left:50%;transform:translateX(-50%);pointer-events:none;padding:6px 14px;border-radius:999px;background:rgba(20,20,40,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fff;font:600 13px ui-monospace,system-ui;white-space:nowrap;border:1px solid rgba(255,255,255,.12)";
    stage.host.appendChild(info);

    // Ground.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), M(0x0f3b3a, { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(26, -0.02, 36);
    ground.receiveShadow = true;
    scene.add(ground);

    // Track ribbon, kerbs and barriers from the centreline.
    const normals = TRACK.map((p, i) => {
      const a = TRACK[(i - 1 + SAMPLES) % SAMPLES];
      const b = TRACK[(i + 1) % SAMPLES];
      const tx = b[0] - a[0];
      const ty = b[1] - a[1];
      const l = Math.hypot(tx, ty);
      return [-ty / l, tx / l] as const;
    });
    function ribbon(inner: number, outer: number, y: number, colorAt: (i: number) => THREE.Color) {
      const pos: number[] = [];
      const col: number[] = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const k = i % SAMPLES;
        const [x, z] = TRACK[k];
        const [nx, nz] = normals[k];
        const c = colorAt(i);
        pos.push(x + nx * inner, y, z + nz * inner, x + nx * outer, y, z + nz * outer);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      const idx: number[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      scene.add(m);
    }
    const asphalt = new THREE.Color(0x2b2d42);
    ribbon(-WIDTH / 2, WIDTH / 2, 0, (i) => (i < 3 ? new THREE.Color(i % 2 ? 0xffffff : 0x111111) : asphalt));
    const kerb = (i: number) => new THREE.Color(Math.floor(i / 2) % 2 ? 0xf8fafc : 0xef4444);
    ribbon(WIDTH / 2, WIDTH / 2 + 0.9, 0.01, kerb);
    ribbon(-WIDTH / 2 - 0.9, -WIDTH / 2, 0.01, kerb);
    const barrierM = M(0xff4d8d, { emissive: 0xff4d8d, emissiveIntensity: 0.9 });
    for (const side of [-1, 1])
      for (let i = 0; i < SAMPLES; i += 2) {
        const [x, z] = TRACK[i];
        const [nx, nz] = normals[i];
        const d = side * (WIDTH / 2 + BARRIER);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), i % 8 ? M(0x3730a3) : barrierM);
        post.position.set(x + nx * d, 0.4, z + nz * d);
        scene.add(post);
      }

    const car = (color: number, ghost: boolean) => {
      const g = new THREE.Group();
      const mt = M(color, { roughness: 0.3, metalness: 0.2, transparent: ghost, opacity: ghost ? 0.35 : 1 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 1.7), mt);
      body.position.y = 0.55;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.4), M(ghost ? color : 0x1e1b4b, { transparent: ghost, opacity: ghost ? 0.3 : 1, roughness: 0.2 }));
      cab.position.set(-0.3, 1.15, 0);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 1.8), mt);
      wing.position.set(-1.6, 1.15, 0);
      g.add(body, cab, wing);
      if (!ghost) {
        for (const x of [-1.1, 1.1])
          for (const z of [-0.85, 0.85]) {
            const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), M(0x0b0b10));
            w.rotation.x = Math.PI / 2;
            w.position.set(x, 0.38, z);
            g.add(w);
          }
        const lights = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 1.4), M(0xfef08a, { emissive: 0xfef08a, emissiveIntensity: 2 }));
        lights.position.set(1.72, 0.6, 0);
        g.add(lights);
        g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      }
      scene.add(g);
      return g;
    };
    const me = car(0x22d3ee, false);
    const ghostCar = car(0xf0abfc, true);

    const smoke: { m: THREE.Mesh; t: number }[] = [];
    const smokeGeo = new THREE.SphereGeometry(0.5, 8, 6);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    stage.onResize(() => {
      camera.aspect = stage.width / Math.max(1, stage.height);
      camera.fov = camera.aspect < 0.8 ? 72 : 58;
      camera.updateProjectionMatrix();
    });
    camera.aspect = stage.width / Math.max(1, stage.height);
    camera.fov = camera.aspect < 0.8 ? 72 : 58;
    camera.updateProjectionMatrix();
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -30;
    sc.right = sc.top = 30;
    sc.updateProjectionMatrix();

    let side: number | null = null;
    const off = input.on((e) => {
      if (e.type !== "drag") return;
      if (e.phase === "end") {
        s.steer = 0;
        s.brake = false;
        side = null;
        return;
      }
      if (e.phase === "start") side = e.x < stage.width / 2 ? -1 : 1;
      // Drag to steer proportionally; or just hold a side of the screen.
      s.steer = Math.abs(e.dx) > 10 ? Math.max(-1, Math.min(1, e.dx / 70)) : (side ?? 0);
      s.brake = e.dy > 45;
    });

    let camH = s.car.h;
    let lastDt = 1 / 60;
    return {
      update(dt) {
        lastDt = dt;
        if (side === null) {
          const k = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
          s.steer = k;
          s.brake = input.isDown("down");
        }
        const ev = step(s, dt);
        if (ev.includes("best")) {
          try {
            localStorage.setItem(GHOST_KEY, JSON.stringify({ ghost: s.ghost, bestLap: s.bestLap }));
          } catch {
            /* private mode: ghost just won't persist */
          }
        }
        if (ev.includes("done")) {
          emit({ type: "score", value: s.score });
          emit({ type: "feel", kind: "success" });
          emit({ type: "over", score: s.score });
        } else if (ev.includes("lap")) emit({ type: "feel", kind: ev.includes("best") ? "success" : "score" });
        else if (ev.includes("bump")) emit({ type: "feel", kind: "fail" });
        if (s.drifting && !reducedMotion) {
          const m = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: 0.5 }));
          m.position.set(s.car.x - Math.cos(s.car.h) * 1.6, 0.4, s.car.y - Math.sin(s.car.h) * 1.6);
          scene.add(m);
          smoke.push({ m, t: 0.8 });
        }
        for (let i = smoke.length - 1; i >= 0; i--) {
          const p = smoke[i];
          p.t -= dt;
          p.m.scale.setScalar(1 + (0.8 - p.t) * 3);
          (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.t * 0.6);
          if (p.t <= 0) {
            scene.remove(p.m);
            (p.m.material as THREE.Material).dispose();
            smoke.splice(i, 1);
          }
        }
      },
      render() {
        const c = s.car;
        me.position.set(c.x, 0, c.y);
        me.rotation.y = -c.h;
        const g = s.ghost && s.countdown <= 0 ? ghostAt(s.ghost, s.t - s.lapStart) : null;
        ghostCar.visible = !!g;
        if (g) {
          ghostCar.position.set(g.x, 0, g.y);
          ghostCar.rotation.y = -g.h;
        }
        const dh = Math.atan2(Math.sin(c.h - camH), Math.cos(c.h - camH));
        camH += dh * Math.min(1, lastDt * 3.5);
        camera.position.set(c.x - Math.cos(camH) * 13, 8, c.y - Math.sin(camH) * 13);
        camera.lookAt(c.x + Math.cos(camH) * 6, 0, c.y + Math.sin(camH) * 6);
        key.position.set(c.x + 10, 30, c.y + 6);
        key.target.position.set(c.x, 0, c.y);
        renderer.render(scene, camera);
        info.style.top = `${insets().top + 6}px`;
        info.textContent =
          s.countdown > 0
            ? `Get ready · ${Math.ceil(s.countdown)}`
            : `Lap ${Math.min(LAPS, s.lap + 1)}/${LAPS} · ${fmt(s.t - s.lapStart)}${s.bestLap ? ` · best ${fmt(s.bestLap)}` : ""}`;
      },
      serialize: () => s,
      restore(data) {
        s = data as DriftState;
        camH = s.car.h;
      },
      destroy() {
        off();
        info.remove();
        scene.fog = null;
        stage.host.style.background = "";
      },
    };
  },
};

export default drift;
