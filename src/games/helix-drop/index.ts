import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { GAP_Y, SLICES, SMASH_COMBO, newGame, rotate, step, type HelixState } from "./logic";

const R_OUT = 3.3;
const R_BALL = 2.35;
const THICK = 0.5;
const PX_PER_RAD = 120;

const helixDrop: GameModule = {
  kind: "3d",
  create({ stage, input, rng, emit, reducedMotion }) {
    const { scene, renderer, key } = stage;
    let s: HelixState = newGame(rng);
    stage.host.style.background = "linear-gradient(180deg, #ff9a9e 0%, #a18cd1 45%, #2b1a5a 100%)";

    const sliceGeo = new THREE.CylinderGeometry(R_OUT, R_OUT, THICK, 6, 1, false, 0, (Math.PI * 2) / SLICES);
    const dangerM = new THREE.MeshStandardMaterial({ color: 0xff1f4b, emissive: 0xb0102e, emissiveIntensity: 0.6, roughness: 0.4 });
    const tower = new THREE.Group();
    scene.add(tower);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1, 24), new THREE.MeshStandardMaterial({ color: 0xfdf2f8, roughness: 0.5 }));
    tower.add(pillar);
    let ringGroups: THREE.Group[] = [];
    let builtFor = "";
    const splatGeo = new THREE.CircleGeometry(0.35, 12);

    function build() {
      ringGroups.forEach((g) => tower.remove(g));
      ringGroups = s.rings.map((r, i) => {
        const g = new THREE.Group();
        g.position.y = -i * GAP_Y;
        const hue = ((s.level * 47 + i * 9) % 360) / 360;
        const safeM = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.75, 0.6), roughness: 0.35 });
        r.slices.forEach((sl, k) => {
          if (sl === "g") return;
          const m = new THREE.Mesh(sliceGeo, sl === "d" ? dangerM : safeM);
          m.rotation.y = (k / SLICES) * Math.PI * 2;
          m.position.y = -THICK / 2;
          m.castShadow = m.receiveShadow = true;
          g.add(m);
        });
        tower.add(g);
        return g;
      });
      // Bottom platform.
      const base = new THREE.Group();
      base.position.y = -s.rings.length * GAP_Y;
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(R_OUT, R_OUT, THICK, 48), new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x16a34a, emissiveIntensity: 0.5 }));
      plat.position.y = -THICK / 2;
      base.add(plat);
      tower.add(base);
      ringGroups.push(base);
      pillar.scale.y = s.rings.length * GAP_Y + 8;
      pillar.position.y = -(s.rings.length * GAP_Y) / 2 + 2;
    }

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xf59e0b, emissiveIntensity: 0.35, roughness: 0.3 }));
    ball.castShadow = true;
    scene.add(ball);
    const flames: { m: THREE.Mesh; t: number }[] = [];
    const shards: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    const resize = () => {
      camera.aspect = stage.width / Math.max(1, stage.height);
      camera.fov = camera.aspect < 0.8 ? 62 : 50;
      camera.updateProjectionMatrix();
    };
    stage.onResize(resize);
    resize();

    let lastX = 0;
    const off = input.on((e) => {
      if (e.type !== "drag") return;
      if (e.phase === "start") lastX = e.x;
      else if (e.phase === "move") {
        rotate(s, (e.x - lastX) / PX_PER_RAD);
        lastX = e.x;
      }
    });

    let camY = s.y;
    let squash = 0;
    let lastDt = 1 / 60;
    return {
      update(dt) {
        lastDt = dt;
        const k = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
        if (k) rotate(s, k * 3.2 * dt);
        const score = s.score;
        const ev = step(s, dt, rng);
        if (s.score !== score) emit({ type: "score", value: s.score });
        if (ev.includes("dead")) {
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.score });
        } else if (ev.includes("level") || ev.includes("smash")) emit({ type: "feel", kind: "success" });
        else if (ev.includes("pass")) emit({ type: "feel", kind: "score" });
        if (ev.includes("bounce")) {
          squash = 1;
          // A paint splat where the ball hit, stuck to the ring so it turns with the tower.
          const g = ringGroups[s.next];
          if (g && !reducedMotion) {
            const splat = new THREE.Mesh(splatGeo, new THREE.MeshBasicMaterial({ color: 0xffd166 }));
            splat.rotation.x = -Math.PI / 2;
            const a = -s.theta;
            splat.position.set(Math.sin(a) * R_BALL, 0.01, Math.cos(a) * R_BALL);
            g.add(splat);
          }
        }
        if (ev.includes("smash") && !reducedMotion) {
          const g = ringGroups[s.next - 1]; // the ring just smashed
          if (g) {
            for (const c of [...g.children]) {
              const m = c as THREE.Mesh;
              scene.attach(m); // keep its world pose, detach from the spinning tower
              shards.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 8, 4 + Math.random() * 4, 4 + Math.random() * 4), t: 1 });
            }
          }
        }
        squash = Math.max(0, squash - dt * 6);
        for (let i = shards.length - 1; i >= 0; i--) {
          const p = shards[i];
          p.t -= dt;
          p.v.y -= 30 * dt;
          p.m.position.addScaledVector(p.v, dt);
          p.m.rotation.x += dt * 4;
          if (p.t <= 0) {
            scene.remove(p.m);
            shards.splice(i, 1);
          }
        }
        if (s.combo >= SMASH_COMBO && !reducedMotion) {
          const f = new THREE.Mesh(splatGeo, new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.7 }));
          f.position.copy(ball.position);
          f.lookAt(camera.position);
          scene.add(f);
          flames.push({ m: f, t: 0.35 });
        }
        for (let i = flames.length - 1; i >= 0; i--) {
          const p = flames[i];
          p.t -= dt;
          p.m.scale.setScalar(p.t * 3);
          if (p.t <= 0) {
            scene.remove(p.m);
            flames.splice(i, 1);
          }
        }
      },
      render() {
        const tag = `${s.level}:${s.rings.length}`;
        if (tag !== builtFor) {
          builtFor = tag;
          build();
        }
        s.rings.forEach((r, i) => {
          if (r.broken && ringGroups[i].children.length) ringGroups[i].clear();
        });
        tower.rotation.y = s.theta;
        // Only the rings near the ball need drawing.
        ringGroups.forEach((g, i) => (g.visible = Math.abs(i - s.next) < 10));
        const sq = reducedMotion ? 0 : squash;
        ball.position.set(0, s.y + 0.42 * (1 - sq * 0.35), R_BALL);
        ball.scale.set(1 + sq * 0.3, 1 - sq * 0.35, 1 + sq * 0.3);
        (ball.material as THREE.MeshStandardMaterial).emissiveIntensity = s.combo >= SMASH_COMBO ? 1.4 : 0.35;
        camY += (Math.min(camY, s.y) - camY) * Math.min(1, lastDt * 8);
        if (s.y < camY - 0.01) camY = s.y;
        camera.position.set(0, camY + 6, 11);
        camera.lookAt(0, camY - 2.5, 0);
        key.position.set(5, camY + 14, 8);
        key.target.position.set(0, camY - 3, 0);
        renderer.render(scene, camera);
      },
      serialize: () => s,
      restore(data) {
        s = data as HelixState;
        builtFor = "";
        camY = s.y;
      },
      destroy() {
        off();
        stage.host.style.background = "";
      },
    };
  },
};

export default helixDrop;
