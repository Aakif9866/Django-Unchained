/**
 * Shared 3D view for the lane runners: chase camera, pooled meshes keyed by id, player model with
 * run / jump / roll poses, fog and a sky. Each game supplies its theme, ground and models.
 */
import * as THREE from "three";
import type { ThreeStage } from "@/engine/stage";
import type { Obstacle, Pickup, RunnerState } from "./runner-core";

export const LANE_W = 2.2;
export type PathFn = (z: number) => { x: number; y: number };
const flat: PathFn = () => ({ x: 0, y: 0 });

export interface RunnerTheme {
  sky: string; // CSS background behind the transparent canvas
  fog: number;
  path?: PathFn;
  body: number;
  accent: number;
  model(o: Obstacle): THREE.Object3D;
  pickup(p: Pickup): THREE.Object3D;
  /** Builds the ground; `update` repositions it each frame for the current distance. */
  ground(scene: THREE.Scene, path: PathFn): { update(z: number, s: RunnerState): void };
}

export const mat = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o });
export function mesh(geo: THREE.BufferGeometry, m: THREE.Material, shadow = true) {
  const x = new THREE.Mesh(geo, m);
  x.castShadow = shadow;
  x.receiveShadow = true;
  return x;
}

export function createRunnerView(stage: ThreeStage, theme: RunnerTheme, reducedMotion: boolean) {
  const { scene, renderer, key } = stage;
  const path = theme.path ?? flat;
  scene.fog = new THREE.Fog(theme.fog, 45, 150);
  stage.host.style.background = theme.sky;
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  const resize = () => {
    camera.aspect = stage.width / Math.max(1, stage.height);
    // Portrait screens get a wider vertical FOV so all three lanes stay in view.
    camera.fov = camera.aspect < 0.8 ? 68 : 55;
    camera.updateProjectionMatrix();
  };
  stage.onResize(resize);
  resize();
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -14;
  sc.right = sc.top = 14;
  sc.far = 80;
  sc.updateProjectionMatrix();

  const ground = theme.ground(scene, path);

  // Player: capsule body, head, visor; poses come from state.
  const player = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, 14), mat(theme.body, { roughness: 0.35 }));
  body.position.y = 0.85;
  const head = mesh(new THREE.SphereGeometry(0.34, 20, 16), mat(0xfff1e6, { roughness: 0.4 }));
  head.position.y = 1.65;
  const visor = mesh(new THREE.BoxGeometry(0.46, 0.14, 0.2), mat(theme.accent, { emissive: theme.accent, emissiveIntensity: 0.9 }));
  visor.position.set(0, 1.68, 0.24);
  const pack = mesh(new THREE.BoxGeometry(0.5, 0.55, 0.25), mat(theme.accent, { roughness: 0.3 }));
  pack.position.set(0, 1.0, -0.36);
  player.add(body, head, visor, pack);
  scene.add(player);

  const pool = new Map<number, THREE.Object3D>();
  const sync = (items: { id: number }[], make: (it: never) => THREE.Object3D) => {
    const live = new Set<number>();
    for (const it of items) {
      live.add(it.id);
      if (!pool.has(it.id)) {
        const o = make(it as never);
        pool.set(it.id, o);
        scene.add(o);
      }
    }
    return live;
  };

  let camX = 0;
  let clock = 0;

  return {
    render(s: RunnerState, dt: number, crashed: boolean) {
      clock += dt;
      const liveO = sync(s.obstacles, theme.model);
      const liveP = sync(s.pickups, theme.pickup);
      for (const [id, o] of pool)
        if (!liveO.has(id) && !liveP.has(id)) {
          scene.remove(o);
          pool.delete(id);
        }
      const yawAt = (z: number) => Math.atan2(path(z + 1).x - path(z - 1).x, 2);
      for (const o of s.obstacles) {
        const m = pool.get(o.id)!;
        const zc = o.z + o.len / 2;
        const p = path(zc);
        m.position.set(p.x - (o.kind === "gap" ? 0 : o.lane * LANE_W), p.y, zc);
        m.rotation.y = yawAt(zc);
      }
      for (const pk of s.pickups) {
        const m = pool.get(pk.id)!;
        const p = path(pk.z);
        m.position.set(p.x - pk.lane * LANE_W, p.y + pk.y + (reducedMotion ? 0 : Math.sin(clock * 3 + pk.id) * 0.12), pk.z);
        m.rotation.y = reducedMotion ? 0 : clock * 2.5 + pk.id;
      }

      const p = path(s.z);
      // The chase camera looks down +z, where world +x is screen-left, so lanes are drawn mirrored: lane +1 is on the right.
      const px = p.x - s.x * LANE_W;
      player.position.set(px, p.y + s.y, s.z);
      player.rotation.y = yawAt(s.z);
      const rolling = s.roll > 0 && s.y < 0.6;
      player.scale.set(1, rolling ? 0.5 : 1, 1);
      const bob = reducedMotion || s.y > 0 || rolling || crashed ? 0 : Math.abs(Math.sin(s.z * 1.1)) * 0.12;
      body.position.y = 0.85 + bob;
      player.rotation.z = (s.lane - s.x) * 0.35; // lean into lane changes
      player.rotation.x = crashed ? -1.2 : rolling ? 0.4 : 0;

      ground.update(s.z, s);
      camX += (px - camX) * Math.min(1, dt * 6);
      const back = path(s.z - 10.5);
      camera.position.set(camX * 0.6 + back.x * 0.4, back.y + 6.2, s.z - 10.5);
      const ahead = path(s.z + 14);
      camera.lookAt(camX * 0.4 + ahead.x * 0.6, ahead.y + 0.5, s.z + 14);
      key.position.set(px + 6, p.y + 14, s.z + 2);
      key.target.position.set(px, p.y, s.z + 6);
      renderer.render(scene, camera);
    },
    destroy() {
      stage.host.style.background = "";
      scene.fog = null;
    },
  };
}
