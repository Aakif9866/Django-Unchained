import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { BALL_R, CUP_R, HOLES, newGame, shoot, step, type GolfState, type Hole, type P } from "./logic";

const PULL = 7; // world units of pull-back for full power

const pocketGolf: GameModule = {
  kind: "3d",
  create({ stage, input, emit, insets }) {
    const { scene, renderer, key } = stage;
    let s: GolfState = newGame();
    stage.host.style.background = "radial-gradient(130% 90% at 50% 10%, #1e3a8a 0%, #312e81 45%, #0b0b1e 100%)";

    const info = document.createElement("div");
    info.style.cssText =
      "position:absolute;left:50%;transform:translateX(-50%);pointer-events:none;padding:6px 14px;border-radius:999px;background:rgba(20,20,40,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fff;font:600 13px system-ui;letter-spacing:.02em;white-space:nowrap;border:1px solid rgba(255,255,255,.12)";
    stage.host.appendChild(info);

    const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
    let course = new THREE.Group();
    let built = -1;
    let center: P = [0, 0];
    const W = (x: number, y: number) => new THREE.Vector3(x - center[0], 0, -(y - center[1]));
    const shapeOf = (poly: P[]) => new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x - center[0], y - center[1])));

    function build(h: Hole) {
      scene.remove(course);
      course = new THREE.Group();
      const xs = h.boundary.map((p) => p[0]);
      const ys = h.boundary.map((p) => p[1]);
      center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      const flat = (geo: THREE.BufferGeometry, m: THREE.Material, y: number) => {
        const x = new THREE.Mesh(geo, m);
        x.rotation.x = -Math.PI / 2;
        x.position.y = y;
        x.receiveShadow = true;
        course.add(x);
        return x;
      };
      const base = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(h.boundary), { depth: 1.2, bevelEnabled: false }), M(0x1e1b4b));
      base.rotation.x = -Math.PI / 2;
      base.position.y = -1.21;
      course.add(base);
      flat(new THREE.ShapeGeometry(shapeOf(h.boundary)), M(0x34d399, { roughness: 0.9 }), 0);
      // Mown stripes for texture.
      for (let y = Math.min(...ys); y < Math.max(...ys); y += 4) {
        const band = flat(new THREE.PlaneGeometry(Math.max(...xs) - Math.min(...xs), 2), M(0x10b981, { roughness: 0.9, transparent: true, opacity: 0.35 }), 0.005);
        band.position.set(0, 0.005, -(y + 1 - center[1]));
      }
      for (const r of h.sand) {
        const m = flat(new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0), M(0xfde68a), 0.01);
        m.position.set((r.x0 + r.x1) / 2 - center[0], 0.01, -((r.y0 + r.y1) / 2 - center[1]));
      }
      for (const r of h.water) {
        const m = flat(new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0), M(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 0.6, roughness: 0.15 }), 0.012);
        m.position.set((r.x0 + r.x1) / 2 - center[0], 0.012, -((r.y0 + r.y1) / 2 - center[1]));
      }
      for (const sl of h.slopes) {
        const m = flat(new THREE.PlaneGeometry(sl.x1 - sl.x0, sl.y1 - sl.y0), M(0xa7f3d0, { transparent: true, opacity: 0.35 }), 0.008);
        m.position.set((sl.x0 + sl.x1) / 2 - center[0], 0.008, -((sl.y0 + sl.y1) / 2 - center[1]));
        // Chevrons point downhill.
        const a = Math.atan2(-sl.fy, sl.fx);
        for (let x = sl.x0 + 1.5; x < sl.x1; x += 3)
          for (let y = sl.y0 + 1.5; y < sl.y1; y += 3) {
            const c = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 3), M(0xecfccb, { transparent: true, opacity: 0.6 }));
            c.rotation.set(-Math.PI / 2, 0, a - Math.PI / 2); // lie flat, tip pointing downhill
            c.position.copy(W(x, y)).setY(0.05);
            course.add(c);
          }
      }
      // Rails along every edge, glowing caps.
      const railM = M(0x7c3aed, { roughness: 0.4 });
      const capM = M(0xf0abfc, { emissive: 0xe879f9, emissiveIntensity: 0.9 });
      const segs: [P, P][] = [...h.walls];
      for (const poly of [h.boundary, ...h.blocks]) for (let i = 0; i < poly.length; i++) segs.push([poly[i], poly[(i + 1) % poly.length]]);
      for (const [a, b] of segs) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const mid = W((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
        const r = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.6, 0.3), railM);
        r.position.copy(mid).setY(0.3);
        r.rotation.y = ang;
        r.castShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.06, 0.32), capM);
        cap.position.copy(mid).setY(0.62);
        cap.rotation.y = ang;
        course.add(r, cap);
      }
      for (const poly of h.blocks) {
        const b = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(poly), { depth: 0.6, bevelEnabled: false }), M(0x6d28d9, { roughness: 0.5 }));
        b.rotation.x = -Math.PI / 2;
        b.castShadow = true;
        course.add(b);
      }
      // Cup + flag.
      const cup = flat(new THREE.CircleGeometry(CUP_R, 32), M(0x020617), 0.02);
      cup.position.copy(W(...h.cup)).setY(0.02);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), M(0xf8fafc));
      pole.position.copy(W(...h.cup)).setY(1.5);
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 3), M(0xff4d8d, { emissive: 0xff4d8d, emissiveIntensity: 0.5 }));
      flag.rotation.z = -Math.PI / 2;
      flag.position.copy(W(...h.cup)).add(new THREE.Vector3(0.6, 2.6, 0));
      pole.castShadow = flag.castShadow = true;
      course.add(pole, flag);
      scene.add(course);

      const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      const sc = key.shadow.camera;
      sc.left = sc.bottom = -size;
      sc.right = sc.top = size;
      sc.updateProjectionMatrix();
      frameCam(size, Math.max(...xs) - Math.min(...xs));
    }

    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), M(0xffffff, { roughness: 0.25 }));
    ball.castShadow = true;
    scene.add(ball);
    const aim = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.22), M(0xfde047, { emissive: 0xfde047, emissiveIntensity: 1 }));
    aim.visible = false;
    scene.add(aim);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
    let lastSize = 30;
    let lastW = 12;
    function frameCam(size = lastSize, width = lastW) {
      lastSize = size;
      lastW = width;
      const aspect = stage.width / Math.max(1, stage.height);
      camera.aspect = aspect;
      const d = Math.max(size * 1.4, (width * 1.6) / aspect);
      camera.position.set(0, d, d * 0.28);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
    stage.onResize(() => frameCam());

    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const toWorld = (sx: number, sy: number) => {
      ray.setFromCamera(new THREE.Vector2((sx / stage.width) * 2 - 1, -(sy / stage.height) * 2 + 1), camera);
      const v = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, v) ? v : null;
    };
    let pull: { a: number; p: number } | null = null;
    let start: THREE.Vector3 | null = null;
    let keyAim = { a: Math.PI / 2, p: 0.5, on: false };

    const fire = (a: number, p: number) => {
      if (shoot(s, a, p)) emit({ type: "feel", kind: "tap" });
    };
    const off = input.on((e) => {
      if (e.type === "drag") {
        if (e.phase === "start") start = toWorld(e.x, e.y);
        else if (e.phase === "move" && start) {
          const cur = toWorld(e.x, e.y);
          if (!cur) return;
          const dx = start.x - cur.x;
          const dy = -(start.z - cur.z);
          const len = Math.hypot(dx, dy);
          pull = len > 0.3 ? { a: Math.atan2(dy, dx), p: Math.min(1, len / PULL) } : null;
        } else if (e.phase === "end") {
          if (pull) fire(pull.a, pull.p);
          pull = null;
          start = null;
        }
      } else if (e.type === "action") {
        if (e.action === "primary") {
          fire(keyAim.a, keyAim.p);
          keyAim.on = false;
        }
      }
    });

    return {
      update(dt) {
        const turn = (input.isDown("left") ? 1 : 0) - (input.isDown("right") ? 1 : 0);
        const pw = (input.isDown("up") ? 1 : 0) - (input.isDown("down") ? 1 : 0);
        if (turn || pw) keyAim = { a: keyAim.a + turn * 1.5 * dt, p: Math.max(0.05, Math.min(1, keyAim.p + pw * 0.6 * dt)), on: true };
        const before = s.score;
        const ev = step(s, dt);
        if (s.score !== before) emit({ type: "score", value: s.score });
        if (ev.includes("sink")) emit({ type: "feel", kind: "success" });
        else if (ev.includes("water") || ev.includes("pickup")) emit({ type: "feel", kind: "fail" });
        else if (ev.includes("wall")) emit({ type: "feel", kind: "tap" });
        if (ev.includes("done")) emit({ type: "over", score: s.score });
      },
      render() {
        if (built !== s.hole) {
          built = s.hole;
          build(HOLES[s.hole]);
        }
        const h = HOLES[s.hole];
        const drop = s.sunk > 0 ? Math.min(1, (1.2 - s.sunk) * 3) : 0;
        ball.position.copy(W(s.x, s.y)).setY(BALL_R - drop * 0.9);
        ball.visible = drop < 1;
        const a = pull ?? (keyAim.on ? keyAim : null);
        aim.visible = !!a && !s.moving && s.sunk <= 0 && !s.done;
        if (a && aim.visible) {
          const len = 1 + a.p * 7;
          const dir = new THREE.Vector3(Math.cos(a.a), 0, -Math.sin(a.a));
          aim.scale.set(len, 1, 1);
          aim.position.copy(ball.position).addScaledVector(dir, len / 2 + BALL_R).setY(0.1);
          aim.rotation.y = Math.atan2(Math.sin(a.a), Math.cos(a.a));
          (aim.material as THREE.MeshStandardMaterial).color.setHSL(0.33 - a.p * 0.33, 0.95, 0.55);
          (aim.material as THREE.MeshStandardMaterial).emissive.setHSL(0.33 - a.p * 0.33, 0.95, 0.4);
        }
        info.style.top = `${insets().top + 6}px`;
        info.textContent = s.done ? `Round complete · ${s.cards.reduce((x, y) => x + y, 0)} strokes` : `Hole ${s.hole + 1}/9 · Par ${h.par} · Stroke ${s.strokes}`;
        key.position.set(8, 30, 10);
        renderer.render(scene, camera);
      },
      serialize: () => s,
      restore(data) {
        s = data as GolfState;
        built = -1;
      },
      destroy() {
        off();
        info.remove();
        stage.host.style.background = "";
      },
    };
  },
};

export default pocketGolf;
