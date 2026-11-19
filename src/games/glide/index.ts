import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { HEIGHT, RANGE, drop, moving, newGame, update, type Block, type GlideState } from "./logic";

const HUE0 = 345; // starts on the card's pink, walks the colour wheel as you climb
const BASE_DEPTH = 8;

const glide: GameModule = {
  kind: "3d",
  create({ stage, input, emit, reducedMotion }) {
    const { scene, renderer, key } = stage;
    let s: GlideState = newGame();

    const box = new THREE.BoxGeometry(1, 1, 1);
    const colorFor = (i: number) => new THREE.Color().setHSL(((HUE0 + i * 7) % 360) / 360, 0.82, 0.58);
    const material = (i: number) =>
      new THREE.MeshStandardMaterial({ color: colorFor(i), roughness: 0.38, metalness: 0.04 });
    const place = (m: THREE.Mesh, b: Block, y: number) => {
      m.scale.set(b.w, HEIGHT, b.d);
      m.position.set(b.x, y, b.z);
    };
    const meshFor = (i: number) => {
      const m = new THREE.Mesh(box, material(i));
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      return m;
    };

    const tower: THREE.Mesh[] = [];
    const slider = meshFor(1);
    const debris: { m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3 }[] = [];
    const flash = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    scene.add(flash);
    let flashT = 0;
    let flashSize = { w: 0, d: 0 };

    const sc = key.shadow.camera;
    sc.left = sc.bottom = -8;
    sc.right = sc.top = 8;
    sc.updateProjectionMatrix();

    const camera = new THREE.OrthographicCamera();
    let camY = 0;
    let zoomOut = 0; // 0 → playing view, 1 → whole tower after game over

    function frame() {
      const aspect = stage.width / Math.max(1, stage.height);
      const towerH = s.blocks.length * HEIGHT;
      const half = Math.max(5.2 + zoomOut * towerH * 0.5, (RANGE + 2) / aspect);
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.near = -100;
      camera.far = 100;
      camera.updateProjectionMatrix();
    }
    stage.onResize(frame);

    function paintBackdrop() {
      const h = (HUE0 + s.score * 7) % 360;
      stage.host.style.background = `radial-gradient(120% 80% at 50% 20%, hsl(${h} 75% 30%), hsl(${(h + 320) % 360} 65% 8%) 75%)`;
    }
    paintBackdrop();

    const spawnDebris = (b: Block, i: number) => {
      const m = meshFor(i);
      place(m, b, i * HEIGHT);
      const out = new THREE.Vector3(b.x - (s.blocks.at(-1)?.x ?? 0), 0, b.z - (s.blocks.at(-1)?.z ?? 0)).normalize();
      debris.push({ m, v: new THREE.Vector3(out.x * 1.5, 0, out.z * 1.5), spin: new THREE.Vector3(out.z * 2, 0, -out.x * 2) });
    };

    const off = input.on((e) => {
      if (s.over || !(e.type === "tap" || (e.type === "action" && e.action === "primary"))) return;
      const i = s.blocks.length;
      const r = drop(s);
      if (r.kind === "miss") {
        spawnDebris(r.piece, i);
        slider.visible = false;
        emit({ type: "feel", kind: "fail" });
        emit({ type: "over", score: s.score });
        return;
      }
      if (r.kind === "cut") {
        spawnDebris(r.piece, i);
        emit({ type: "feel", kind: "tap" });
      } else {
        flashT = 1;
        place(flash, r.placed, i * HEIGHT);
        flashSize = { w: r.placed.w, d: r.placed.d };
        emit({ type: "feel", kind: s.combo >= 3 ? "success" : "score" });
      }
      (slider.material as THREE.MeshStandardMaterial).color = colorFor(i + 1);
      emit({ type: "score", value: s.score });
      paintBackdrop();
    });

    return {
      update(dt) {
        update(s, dt);
        const target = Math.max(0, (s.blocks.length - 1) * HEIGHT - 1.5);
        camY += (target - camY) * Math.min(1, dt * 4);
        if (s.over) zoomOut = Math.min(1, zoomOut + dt * 1.2);
        for (let k = debris.length - 1; k >= 0; k--) {
          const d = debris[k];
          d.v.y -= 22 * dt;
          d.m.position.addScaledVector(d.v, dt);
          d.m.rotation.x += d.spin.x * dt;
          d.m.rotation.z += d.spin.z * dt;
          if (d.m.position.y < camY - 20) {
            scene.remove(d.m);
            (d.m.material as THREE.Material).dispose();
            debris.splice(k, 1);
          }
        }
        if (flashT > 0) flashT = Math.max(0, flashT - dt * 2.5);
      },

      render() {
        // Keep meshes in step with state (also rebuilds everything after a restore).
        while (tower.length < s.blocks.length) tower.push(meshFor(tower.length));
        s.blocks.forEach((b, i) => {
          if (i === 0) {
            tower[0].scale.set(b.w, BASE_DEPTH, b.d);
            tower[0].position.set(b.x, HEIGHT / 2 - BASE_DEPTH / 2, b.z);
          } else place(tower[i], b, i * HEIGHT);
        });
        if (!s.over) place(slider, moving(s), s.blocks.length * HEIGHT);

        // Perfect-drop halo: a thin sheet of light that spreads out from the block and fades.
        const fm = flash.material as THREE.MeshBasicMaterial;
        fm.opacity = reducedMotion ? 0 : flashT * 0.6;
        const grow = 1 + (1 - flashT) * 0.3;
        flash.scale.set(flashSize.w * grow, HEIGHT * 1.02, flashSize.d * grow);

        const lookY = camY * (1 - zoomOut) + ((s.blocks.length * HEIGHT) / 2) * zoomOut;
        frame();
        camera.position.set(10, lookY + 10, 10);
        camera.lookAt(0, lookY, 0);
        key.position.set(6, lookY + 12, 4);
        key.target.position.set(0, lookY, 0);
        renderer.render(scene, camera);
      },

      serialize: () => s,
      restore(data) {
        s = data as GlideState;
        camY = Math.max(0, (s.blocks.length - 1) * HEIGHT - 1.5);
        (slider.material as THREE.MeshStandardMaterial).color = colorFor(s.blocks.length);
        paintBackdrop();
      },
      destroy() {
        off();
        stage.host.style.background = "";
      },
    };
  },
};

export default glide;
