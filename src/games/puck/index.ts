import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { GOAL_W, H, MALLET_R, PUCK_R, TO_WIN, W, aimYou, newGame, step, type PuckState } from "./logic";

const S = 0.1; // logic units → scene units
const X = (x: number) => (x - W / 2) * S;
const Z = (y: number) => (y - H / 2) * S;

const puck: GameModule = {
  kind: "3d",
  create({ difficulty, stage, input, rng, emit, reducedMotion }) {
    const { scene, renderer, key } = stage;
    let s: PuckState = newGame(difficulty);
    stage.host.style.background = "radial-gradient(120% 80% at 50% 30%, #3b2a7a 0%, #140f2e 60%, #07060f 100%)";
    const tw = W * S;
    const th = H * S;

    // Surface: a canvas texture with markings and the live score.
    const cv = document.createElement("canvas");
    cv.width = 600;
    cv.height = 1000;
    const c2 = cv.getContext("2d")!;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    let painted = "";
    const paint = () => {
      const tag = `${s.pts.you}-${s.pts.cpu}-${s.level}`;
      if (tag === painted) return;
      painted = tag;
      const g = c2.createLinearGradient(0, 0, 0, 1000);
      g.addColorStop(0, "#e9e6ff");
      g.addColorStop(0.5, "#f7f7ff");
      g.addColorStop(1, "#e2f6ff");
      c2.fillStyle = g;
      c2.fillRect(0, 0, 600, 1000);
      c2.lineWidth = 6;
      c2.strokeStyle = "rgba(124,58,237,0.45)";
      c2.beginPath();
      c2.moveTo(0, 500);
      c2.lineTo(600, 500);
      c2.stroke();
      c2.beginPath();
      c2.arc(300, 500, 90, 0, Math.PI * 2);
      c2.stroke();
      c2.strokeStyle = "rgba(236,72,153,0.45)";
      c2.beginPath();
      c2.arc(300, 0, 150, 0, Math.PI);
      c2.stroke();
      c2.strokeStyle = "rgba(14,165,233,0.45)";
      c2.beginPath();
      c2.arc(300, 1000, 150, Math.PI, Math.PI * 2);
      c2.stroke();
      c2.font = "800 150px system-ui, sans-serif";
      c2.textAlign = "center";
      c2.fillStyle = "rgba(236,72,153,0.16)";
      c2.fillText(String(s.pts.cpu), 300, 360);
      c2.fillStyle = "rgba(14,165,233,0.18)";
      c2.fillText(String(s.pts.you), 300, 760);
      c2.font = "600 26px system-ui, sans-serif";
      c2.fillStyle = "rgba(60,40,120,0.45)";
      c2.fillText(`MATCH ${s.level + 1} · FIRST TO ${TO_WIN}`, 300, 545);
      tex.needsUpdate = true;
    };
    paint();

    const surface = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.3, th), [
      new THREE.MeshStandardMaterial({ color: 0x3b2a7a }),
      new THREE.MeshStandardMaterial({ color: 0x3b2a7a }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0 }),
      new THREE.MeshStandardMaterial({ color: 0x3b2a7a }),
      new THREE.MeshStandardMaterial({ color: 0x3b2a7a }),
      new THREE.MeshStandardMaterial({ color: 0x3b2a7a }),
    ]);
    surface.position.y = -0.15;
    surface.receiveShadow = true;
    scene.add(surface);
    const base = new THREE.Mesh(new THREE.BoxGeometry(tw + 1, 1.4, th + 1), new THREE.MeshStandardMaterial({ color: 0x1e1546, roughness: 0.6 }));
    base.position.y = -0.95;
    scene.add(base);

    // Rails with neon tops; end rails split around the goal mouth.
    const rail = (x: number, z: number, w: number, d: number, color: number) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), new THREE.MeshStandardMaterial({ color: 0x241a52, roughness: 0.4 }));
      r.position.set(x, 0.1, z);
      r.castShadow = true;
      const glow = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 }));
      glow.position.set(x, 0.3, z);
      scene.add(r, glow);
    };
    rail(-tw / 2 - 0.15, 0, 0.3, th + 0.6, 0x8b5cf6);
    rail(tw / 2 + 0.15, 0, 0.3, th + 0.6, 0x8b5cf6);
    const side = (tw - GOAL_W * S) / 2;
    for (const [z, c] of [[-th / 2 - 0.15, 0xec4899], [th / 2 + 0.15, 0x0ea5e9]] as const) {
      rail(-tw / 2 + side / 2, z, side, 0.3, c);
      rail(tw / 2 - side / 2, z, side, 0.3, c);
    }

    const mallet = (color: number) => {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.1 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(MALLET_R * S, MALLET_R * S * 1.05, 0.22, 32), m);
      disc.position.y = 0.11;
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(MALLET_R * S * 0.4, MALLET_R * S * 0.5, 0.4, 24), m);
      knob.position.y = 0.42;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(MALLET_R * S * 0.42, 20, 12), m);
      cap.position.y = 0.62;
      for (const x of [disc, knob, cap]) x.castShadow = true;
      g.add(disc, knob, cap);
      scene.add(g);
      return g;
    };
    const you = mallet(0x0ea5e9);
    const cpu = mallet(0xec4899);
    const puckMesh = new THREE.Group();
    const pd = new THREE.Mesh(new THREE.CylinderGeometry(PUCK_R * S, PUCK_R * S, 0.14, 32), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3 }));
    pd.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(PUCK_R * S * 0.8, 0.03, 8, 32), new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 1.5 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.075;
    puckMesh.add(pd, ring);
    puckMesh.position.y = 0.07;
    scene.add(puckMesh);

    const sc = key.shadow.camera;
    sc.left = sc.bottom = -7;
    sc.right = sc.top = 7;
    sc.updateProjectionMatrix();
    key.position.set(2, 12, 4);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const frame = () => {
      const aspect = stage.width / Math.max(1, stage.height);
      camera.aspect = aspect;
      // Back off until the whole table fits in either orientation.
      const dist = Math.max(11, 7.2 / Math.max(0.35, aspect));
      camera.position.set(0, dist * 0.95, dist * 0.5);
      camera.lookAt(0, 0, 0.35);
      camera.updateProjectionMatrix();
    };
    stage.onResize(frame);
    frame();

    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const toTable = (sx: number, sy: number) => {
      ray.setFromCamera(new THREE.Vector2((sx / stage.width) * 2 - 1, -(sy / stage.height) * 2 + 1), camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      return { x: hit.x / S + W / 2, y: hit.z / S + H / 2 };
    };
    const off = input.on((e) => {
      if (e.type === "drag" || e.type === "tap") {
        const p = toTable(e.x, e.y);
        if (p) aimYou(s, p.x, p.y);
      }
    });

    let flash = 0;
    return {
      update(dt) {
        const kx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
        const ky = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
        if (kx || ky) aimYou(s, s.you.x + kx * 60 * dt * 3, s.you.y + ky * 60 * dt * 3);
        flash = Math.max(0, flash - dt * 2);
        const score = s.score;
        const ev = step(s, dt, rng);
        if (s.score !== score) emit({ type: "score", value: s.score });
        if (ev.includes("dead")) {
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.score });
        } else if (ev.includes("match")) emit({ type: "feel", kind: "success" });
        else if (ev.includes("goal-you")) {
          flash = 1;
          emit({ type: "feel", kind: "score" });
        } else if (ev.includes("goal-cpu")) emit({ type: "feel", kind: "fail" });
        else if (ev.includes("hit")) emit({ type: "feel", kind: "tap" });
      },
      render() {
        paint();
        you.position.set(X(s.you.x), 0, Z(s.you.y));
        cpu.position.set(X(s.cpu.x), 0, Z(s.cpu.y));
        puckMesh.position.set(X(s.puck.x), 0.07, Z(s.puck.y));
        (ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + (reducedMotion ? 0 : flash * 3);
        renderer.render(scene, camera);
      },
      serialize: () => s,
      restore(data) {
        s = data as PuckState;
        painted = "";
      },
      destroy() {
        off();
        tex.dispose();
        stage.host.style.background = "";
      },
    };
  },
};

export default puck;
