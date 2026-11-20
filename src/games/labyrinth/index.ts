import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { BALL_R, HOLE_R, LIVES, newGame, segments, setTilt, step, type LabState } from "./logic";

const DRAG_FULL = 70; // px of drag for full tilt

const labyrinth: GameModule = {
  kind: "3d",
  create({ stage, input, rng, emit, insets, reducedMotion }) {
    const { scene, renderer, key } = stage;
    let s: LabState = newGame(rng);
    stage.host.style.background = "radial-gradient(120% 90% at 50% 20%, #7c2d12 0%, #4a1d4f 45%, #0c0a1d 100%)";
    const info = document.createElement("div");
    info.style.cssText =
      "position:absolute;left:50%;transform:translateX(-50%);pointer-events:none;padding:6px 14px;border-radius:999px;background:rgba(20,20,40,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fff;font:600 13px system-ui;white-space:nowrap;border:1px solid rgba(255,255,255,.12)";
    stage.host.appendChild(info);
    const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });

    const board = new THREE.Group();
    scene.add(board);
    let maze = new THREE.Group();
    let builtFor = "";
    const wallM = M(0xf6d365, { emissive: 0xfda085, emissiveIntensity: 0.35, roughness: 0.35 });
    function build() {
      board.remove(maze);
      maze = new THREE.Group();
      const n = s.n;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(n + 0.6, 0.4, n + 0.6), M(0x2a1840, { roughness: 0.8 }));
      floor.position.y = -0.2;
      floor.receiveShadow = true;
      maze.add(floor);
      // Faint grid so motion reads even on open stretches.
      const grid = new THREE.GridHelper(n, n, 0x6d28d9, 0x4c1d95);
      grid.position.y = 0.002;
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.35;
      maze.add(grid);
      for (const [x0, y0, x1, y1] of segments(s)) {
        const horiz = y0 === y1;
        const w = new THREE.Mesh(new THREE.BoxGeometry(horiz ? x1 - x0 + 0.12 : 0.12, 0.45, horiz ? 0.12 : y1 - y0 + 0.12), wallM);
        w.position.set((x0 + x1) / 2 - n / 2, 0.22, (y0 + y1) / 2 - n / 2);
        w.castShadow = true;
        maze.add(w);
      }
      for (const [hx, hy] of s.holes) {
        const h = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R + 0.04, 24), M(0x000000));
        h.rotation.x = -Math.PI / 2;
        h.position.set(hx + 0.5 - n / 2, 0.004, hy + 0.5 - n / 2);
        const ring = new THREE.Mesh(new THREE.RingGeometry(HOLE_R + 0.04, HOLE_R + 0.1, 24), M(0xef4444, { emissive: 0xef4444, emissiveIntensity: 1.2 }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(h.position).setY(0.006);
        maze.add(h, ring);
      }
      const goal = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.38, 32), M(0x4ade80, { emissive: 0x22c55e, emissiveIntensity: 1.6 }));
      goal.rotation.x = -Math.PI / 2;
      goal.position.set(n - 0.5 - n / 2, 0.006, n - 0.5 - n / 2);
      maze.add(goal);
      board.add(maze);
      const sc = key.shadow.camera;
      sc.left = sc.bottom = -n;
      sc.right = sc.top = n;
      sc.updateProjectionMatrix();
      frame();
    }

    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20), M(0xf8fafc, { metalness: 0.25, roughness: 0.18, emissive: 0x334155, emissiveIntensity: 0.3 }));
    ball.castShadow = true;
    board.add(ball);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    function frame() {
      const aspect = stage.width / Math.max(1, stage.height);
      camera.aspect = aspect;
      const ins = insets();
      const usable = (stage.height - ins.top - ins.bottom) / Math.max(1, stage.height);
      const d = (Math.max(s.n * 1.25, (s.n * 1.25) / aspect) / usable) * 1.05;
      camera.position.set(0, d, d * 0.22);
      camera.lookAt(0, 0, 0.3);
      camera.updateProjectionMatrix();
    }
    stage.onResize(frame);

    // Tilt sources: drag (thumb stick), keys, and the gyroscope when the device has one.
    let drag = false;
    let gyro: { x: number; y: number } | null = null;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      gyro = { x: e.gamma / 25, y: (e.beta - 35) / 25 };
    };
    window.addEventListener("deviceorientation", onOrient);
    let asked = false;
    const off = input.on((e) => {
      if (e.type !== "drag") return;
      if (e.phase === "start" && !asked) {
        asked = true;
        const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
        D.requestPermission?.().catch(() => {});
      }
      drag = e.phase !== "end";
      if (e.phase === "move") setTilt(s, e.dx / DRAG_FULL, e.dy / DRAG_FULL);
    });

    return {
      update(dt) {
        const kx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
        const ky = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
        if (kx || ky) setTilt(s, kx, ky);
        else if (!drag && gyro) setTilt(s, gyro.x, gyro.y);
        else if (!drag) setTilt(s, s.tilt.x * 0.9 ** (dt * 60), s.tilt.y * 0.9 ** (dt * 60)); // level out
        const score = s.score;
        const ev = step(s, dt, rng);
        if (s.score !== score) emit({ type: "score", value: s.score });
        if (ev.includes("dead")) {
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.score });
        } else if (ev.includes("goal")) emit({ type: "feel", kind: "success" });
        else if (ev.includes("fall")) emit({ type: "feel", kind: "fail" });
        else if (ev.includes("bump")) emit({ type: "feel", kind: "tap" });
      },
      render() {
        const tag = `${s.level}:${s.n}:${s.holes.join()}`;
        if (tag !== builtFor) {
          builtFor = tag;
          build();
        }
        const n = s.n;
        const fall = s.falling > 0 ? 1 - s.falling / 0.9 : 0;
        ball.position.set(s.ball.x - n / 2, BALL_R - fall * 0.8, s.ball.y - n / 2);
        ball.rotation.x += s.ball.vy * 0.05;
        ball.rotation.z -= s.ball.vx * 0.05;
        ball.visible = fall < 0.95;
        const max = reducedMotion ? 0.04 : 0.12;
        board.rotation.set(s.tilt.y * max, 0, -s.tilt.x * max);
        key.position.set(4, 16, 6);
        renderer.render(scene, camera);
        info.style.top = `${insets().top + 6}px`;
        info.textContent = `Maze ${s.level + 1} · ${n}×${n} · ${"●".repeat(Math.max(0, s.lives))}${"○".repeat(Math.max(0, LIVES - s.lives))}`;
      },
      serialize: () => s,
      restore(data) {
        s = data as LabState;
        builtFor = "";
      },
      destroy() {
        off();
        window.removeEventListener("deviceorientation", onOrient);
        stage.host.style.background = "";
        info.remove();
      },
    };
  },
};

export default labyrinth;
