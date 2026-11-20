import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { HOP_S, SPAN, hop, newGame, step, trainWarning, type HopState, type Lane } from "./logic";

const CAR_COLORS = [0xff4d8d, 0x38bdf8, 0xfbbf24, 0xa78bfa, 0x34d399, 0xfb7185];
const W = SPAN * 2 + 2;

const hopGame: GameModule = {
  kind: "3d",
  create({ stage, input, rng, emit, reducedMotion }) {
    const { scene, renderer, key } = stage;
    let s: HopState = newGame(rng);
    stage.host.style.background = "linear-gradient(180deg, #1e1b4b 0%, #4c1d95 50%, #0f766e 100%)";
    const box = new THREE.BoxGeometry(1, 1, 1);
    const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, flatShading: true, ...o });
    const mk = (geo: THREE.BufferGeometry, m: THREE.Material, sx = 1, sy = 1, sz = 1) => {
      const x = new THREE.Mesh(geo, m);
      x.scale.set(sx, sy, sz);
      x.castShadow = x.receiveShadow = true;
      return x;
    };
    const mats = {
      grassA: M(0x4ade80), grassB: M(0x22c55e), road: M(0x334155), dash: M(0xf8fafc), water: M(0x38bdf8, { emissive: 0x0369a1, emissiveIntensity: 0.35, roughness: 0.2 }),
      gravel: M(0x6b7280), rail: M(0xe5e7eb, { metalness: 0.6 }), trunk: M(0x92400e), leaf: M(0x16a34a), log: M(0xa16207), train: M(0xef4444), stripe: M(0xfde047, { emissive: 0xfde047, emissiveIntensity: 0.5 }),
      lightOff: M(0x7f1d1d), lightOn: M(0xff3b3b, { emissive: 0xff0000, emissiveIntensity: 2 }), wheel: M(0x111827), glass: M(0xbfdbfe, { emissive: 0x60a5fa, emissiveIntensity: 0.3 }),
    };

    interface LaneView {
      g: THREE.Group;
      movers: THREE.Group[];
      light?: THREE.Mesh;
      lane: Lane;
    }
    const views = new Map<number, LaneView>();

    function moverMesh(lane: Lane, len: number, i: number) {
      const g = new THREE.Group();
      if (lane.type === "road") {
        const c = M(CAR_COLORS[i % CAR_COLORS.length], { roughness: 0.35 });
        g.add(mk(box, c, len, 0.5, 0.8));
        g.children[0].position.y = 0.4;
        const cab = mk(box, mats.glass, Math.min(len * 0.55, 1), 0.38, 0.7);
        cab.position.set(len > 2 ? len / 2 - 0.6 : 0, 0.83, 0);
        g.add(cab);
        for (const wx of [-len / 2 + 0.3, len / 2 - 0.3])
          for (const wz of [-0.42, 0.42]) {
            const w = mk(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 10), mats.wheel);
            w.rotation.x = Math.PI / 2;
            w.position.set(wx, 0.17, wz);
            g.add(w);
          }
      } else if (lane.type === "river") {
        const l = mk(new THREE.CylinderGeometry(0.36, 0.36, len, 10), mats.log);
        l.rotation.z = Math.PI / 2;
        l.position.y = 0.05;
        g.add(l);
      } else {
        const t = mk(box, mats.train, len, 1.3, 0.9);
        t.position.y = 0.75;
        const st = mk(box, mats.stripe, len + 0.02, 0.1, 0.92);
        st.position.y = 0.9;
        g.add(t, st);
      }
      scene.add(g);
      return g;
    }

    function buildLane(row: number, lane: Lane): LaneView {
      const g = new THREE.Group();
      g.position.z = row;
      const ground = (m: THREE.Material, y = -0.25, h = 0.5) => {
        const x = mk(box, m, W, h, 1.0);
        x.position.y = y;
        g.add(x);
      };
      let light: THREE.Mesh | undefined;
      if (lane.type === "grass") {
        ground(row % 2 ? mats.grassA : mats.grassB);
        for (const t of lane.trees) {
          const trunk = mk(box, mats.trunk, 0.3, 0.5, 0.3);
          trunk.position.set(-t, 0.25, 0);
          const crown = mk(new THREE.ConeGeometry(0.45, 1.1, 6), mats.leaf);
          crown.position.set(-t, 1.0, 0);
          g.add(trunk, crown);
        }
      } else if (lane.type === "road") {
        ground(mats.road);
        for (let x = -SPAN; x < SPAN; x += 2) {
          const d = mk(box, mats.dash, 0.8, 0.02, 0.08);
          d.position.set(x, 0.01, 0.48);
          g.add(d);
        }
      } else if (lane.type === "river") ground(mats.water, -0.4, 0.4);
      else {
        ground(mats.gravel);
        for (const z of [-0.25, 0.25]) {
          const r = mk(box, mats.rail, W, 0.08, 0.08);
          r.position.set(0, 0.04, z);
          g.add(r);
        }
        const pole = mk(box, mats.trunk, 0.1, 1.2, 0.1);
        pole.position.set(-4.8, 0.6, -0.45);
        light = mk(new THREE.SphereGeometry(0.16, 10, 8), mats.lightOff);
        light.position.set(-4.8, 1.25, -0.45);
        g.add(pole, light);
      }
      scene.add(g);
      return { g, movers: lane.movers.map((m, i) => moverMesh(lane, m.len, i + row)), light, lane };
    }

    const player = new THREE.Group();
    const bodyM = M(0xfff1f2, { roughness: 0.4, flatShading: false });
    const body = mk(new THREE.BoxGeometry(0.62, 0.62, 0.62), bodyM);
    body.position.y = 0.36;
    const crest = mk(box, M(0xff4d8d), 0.2, 0.22, 0.34);
    crest.position.set(0, 0.76, 0);
    const beak = mk(box, M(0xfb923c), 0.18, 0.12, 0.2);
    beak.position.set(0, 0.36, 0.38);
    const eyes = [-0.17, 0.17].map((x) => {
      const e = mk(box, M(0x111827), 0.08, 0.1, 0.04);
      e.position.set(x, 0.5, 0.31);
      return e;
    });
    player.add(body, crest, beak, ...eyes);
    scene.add(player);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    const resize = () => {
      camera.aspect = stage.width / Math.max(1, stage.height);
      camera.fov = camera.aspect < 0.8 ? 56 : 42;
      camera.updateProjectionMatrix();
    };
    stage.onResize(resize);
    resize();
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -16;
    sc.right = sc.top = 16;
    sc.updateProjectionMatrix();

    const go = (d: "up" | "down" | "left" | "right") => {
      const before = s.best;
      if (hop(s, d, rng)) {
        emit({ type: "feel", kind: "tap" });
        if (s.best > before) emit({ type: "score", value: s.best });
      }
    };
    const off = input.on((e) => {
      if (e.type === "tap") go("up");
      else if (e.type === "swipe") go(e.dir);
      else if (e.type === "action" && e.action !== "pause" && e.action !== "secondary") go(e.action === "primary" ? "up" : e.action);
    });

    let camZ = 0;
    let clock = 0;
    let lastDt = 1 / 60;
    let deadT = 0;
    return {
      update(dt) {
        lastDt = dt;
        clock += dt;
        const was = s.alive;
        step(s, dt, rng);
        if (was && !s.alive) {
          emit({ type: "feel", kind: "fail" });
          emit({ type: "over", score: s.best });
        }
        if (!s.alive) deadT += dt;
      },
      render() {
        // Lanes: (re)build views for rows in state, drop the rest.
        for (const [row, v] of views)
          if (!(row in s.lanes) || s.lanes[row].type !== v.lane.type || s.lanes[row].trees.join() !== v.lane.trees.join()) {
            scene.remove(v.g);
            v.movers.forEach((m) => scene.remove(m));
            views.delete(row);
          }
        for (const [k, lane] of Object.entries(s.lanes)) {
          const row = Number(k);
          let v = views.get(row);
          if (!v) views.set(row, (v = buildLane(row, lane)));
          v.lane = lane;
          if (v.movers.length !== lane.movers.length) {
            v.movers.forEach((m) => scene.remove(m));
            v.movers = lane.movers.map((m, i) => moverMesh(lane, m.len, i + row));
          }
          lane.movers.forEach((m, i) => v.movers[i].position.set(-m.x, 0, row)); // view mirrors x: camera looks down +z
          if (v.light) {
            const warn = trainWarning(lane) !== null || lane.movers.length > 0;
            v.light.material = warn && (reducedMotion || Math.floor(clock * 8) % 2 === 0) ? mats.lightOn : mats.lightOff;
          }
        }

        // Player: arc between tiles while hopping, face the hop direction, squash on death.
        const t = 1 - s.hop / HOP_S;
        const px = s.hop > 0 ? s.from.x + (s.x - s.from.x) * t : s.x;
        const pz = s.hop > 0 ? s.from.row + (s.row - s.from.row) * t : s.row;
        const arc = s.hop > 0 && !reducedMotion ? Math.sin(t * Math.PI) * 0.55 : 0;
        const lane = s.lanes[s.row];
        const sink = !s.alive && (s.death === "water" || s.death === "drift") ? -Math.min(0.8, deadT * 2) : 0;
        player.position.set(-px, arc + sink + (lane?.type === "river" ? 0.15 : 0), pz);
        player.rotation.y = { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[s.facing];
        const squash = !s.alive && (s.death === "car" || s.death === "train") ? 0.2 : 1;
        player.scale.set(1 + (1 - squash) * 0.4, squash, 1 + (1 - squash) * 0.4);

        camZ += (Math.max(s.cam + 2.5, pz) - camZ) * Math.min(1, lastDt * 5);
        camera.position.set(-2.2 - px * 0.25, 10.5, camZ - 6.5);
        camera.lookAt(-px * 0.4, 0, camZ + 3);
        key.position.set(-px + 5, 14, camZ + 2);
        key.target.position.set(-px, 0, camZ + 3);
        renderer.render(scene, camera);
      },
      serialize: () => s,
      restore(data) {
        s = data as HopState;
        camZ = s.row;
        deadT = s.alive ? 0 : 1;
      },
      destroy() {
        off();
        stage.host.style.background = "";
      },
    };
  },
};

export default hopGame;
