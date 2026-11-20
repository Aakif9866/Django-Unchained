import * as THREE from "three";
import type { GameModule } from "@/engine/types";
import { LEVELS, groupsOf, newGame, nextLevel, tap, type TurnState } from "./logic";

const GROUP_COLORS: Record<string, number> = { a: 0xc471f5, b: 0xfa71cd, c: 0xf7797d, d: 0x4facfe };
const SPIN = 0.32; // s for a quarter turn
const WALK = 3.2; // cells per second

const turnstile: GameModule = {
  kind: "3d",
  create({ stage, input, emit, insets, reducedMotion }) {
    const { scene, renderer, key } = stage;
    let s: TurnState = newGame();
    stage.host.style.background = "radial-gradient(120% 90% at 50% 15%, #5b2a86 0%, #2a1240 50%, #0b0716 100%)";
    const overlay = (css: string) => {
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;left:50%;transform:translateX(-50%);pointer-events:none;border-radius:999px;background:rgba(20,16,40,.6);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#fff;border:1px solid rgba(255,255,255,.14);text-align:center;" + css;
      stage.host.appendChild(el);
      return el;
    };
    const info = overlay("padding:7px 16px;font:600 13px system-ui;white-space:nowrap");
    const card = overlay("padding:18px 26px;border-radius:24px;font:600 15px system-ui;opacity:0;transition:opacity .3s,transform .3s;top:50%;min-width:220px");
    const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });

    const world = new THREE.Group();
    scene.add(world);
    let board = new THREE.Group();
    let discs = new Map<number, THREE.Group>(); // cell → turnstile mesh group
    let builtFor = -1;
    let beacon: THREE.Mesh | null = null;
    const floorM = M(0x6c5f8d, { roughness: 0.7 });
    const ridgeM = M(0xfdf4ff, { emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.3 });
    const tileGeo = new THREE.BoxGeometry(0.94, 0.3, 0.94);
    const discGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 40);
    const at = (i: number) => new THREE.Vector3((i % s.w) - (s.w - 1) / 2, 0, Math.floor(i / s.w) - (s.h - 1) / 2);

    function ridges(g: THREE.Group, mask: number) {
      g.children.filter((o) => o.userData.ridge).forEach((o) => g.remove(o));
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), ridgeM);
      hub.position.y = 0.2;
      hub.userData.ridge = true;
      g.add(hub);
      for (const [bit, dx, dz] of [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]]) {
        if (!(mask & bit)) continue;
        const r = new THREE.Mesh(new THREE.BoxGeometry(dx ? 0.42 : 0.16, 0.08, dz ? 0.42 : 0.16), ridgeM);
        r.position.set(dx * 0.24, 0.2, dz * 0.24);
        r.userData.ridge = true;
        g.add(r);
      }
      g.userData.mask = mask;
    }

    function build() {
      world.remove(board);
      board = new THREE.Group();
      discs = new Map();
      for (let i = 0; i < s.w * s.h; i++) {
        const k = s.kinds[i];
        if (!k) continue;
        const p = at(i);
        if (k >= "a" && k <= "z") {
          const g = new THREE.Group();
          const disc = new THREE.Mesh(discGeo, M(GROUP_COLORS[k] ?? 0xffffff, { emissive: GROUP_COLORS[k] ?? 0xffffff, emissiveIntensity: 0.25, roughness: 0.35 }));
          disc.castShadow = disc.receiveShadow = true;
          disc.userData.cell = i;
          g.add(disc);
          ridges(g, s.open[i]);
          g.position.copy(p).setY(0.02);
          board.add(g);
          discs.set(i, g);
        } else {
          const t = new THREE.Mesh(tileGeo, floorM);
          t.position.copy(p).setY(-0.02);
          t.receiveShadow = true;
          board.add(t);
          if (k === "S" || k === "G") {
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.36, 32), M(k === "S" ? 0x60a5fa : 0x4ade80, { emissive: k === "S" ? 0x3b82f6 : 0x22c55e, emissiveIntensity: 1.5 }));
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(p).setY(0.14);
            board.add(ring);
          }
          if (k === "G") {
            beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), M(0xbbf7d0, { emissive: 0x4ade80, emissiveIntensity: 1.2 }));
            beacon.position.copy(p).setY(0.75);
            board.add(beacon);
          }
        }
      }
      world.add(board);
      builtFor = s.level;
      const sc = key.shadow.camera;
      sc.left = sc.bottom = -6;
      sc.right = sc.top = 6;
      sc.updateProjectionMatrix();
    }

    // The bot: a round body, a head with two eyes.
    const bot = new THREE.Group();
    const botM = M(0xfff7ed, { emissive: 0xffedd5, emissiveIntensity: 0.25, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.14, 6, 16), botM);
    body.position.y = 0.36;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), botM);
    head.position.y = 0.66;
    const eyeM = M(0x1e1b4b, { roughness: 0.2 });
    for (const x of [-0.055, 0.055]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), eyeM);
      eye.position.set(x, 0.68, 0.13);
      bot.add(eye);
    }
    body.castShadow = head.castShadow = true;
    bot.add(body, head);
    world.add(bot);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const resize = () => {
      camera.aspect = stage.width / Math.max(1, stage.height);
      camera.updateProjectionMatrix();
    };
    stage.onResize(resize);
    resize();

    // View: drag orbits the world (it coasts a little when you let go); a tap turns a turnstile group.
    let yaw = 0.5, yawV = 0, lastX = 0, dragging = false;
    let spinT = new Map<number, number>(); // cell → seconds into its quarter turn
    let walk: { path: number[]; t: number } | null = null;
    let selGroup = -1;
    let shown = 0, overIn = -1, waitNext = false;
    const ray = new THREE.Raycaster();

    function doTap(cell: number) {
      const before = s.score;
      const path = tap(s, cell);
      if (!path) return;
      const g = s.kinds[cell];
      for (const [i, d] of discs) if (s.kinds[i] === g) {
        ridges(d, s.open[i]);
        if (!reducedMotion) spinT.set(i, 0);
      }
      if (s.score !== before) emit({ type: "score", value: s.score });
      if (path.length) {
        walk = { path, t: reducedMotion ? path.length : 0 };
        emit({ type: "feel", kind: "success" });
      } else if (!s.alive) {
        emit({ type: "feel", kind: "fail" });
        overIn = 1.8;
      } else emit({ type: "feel", kind: "tap" });
    }
    function next() {
      nextLevel(s);
      walk = null;
      waitNext = false;
      shown = 0;
      selGroup = -1;
      spinT = new Map();
      emit({ type: "feel", kind: "tap" });
    }

    const off = input.on((e) => {
      if (e.type === "drag") {
        if (e.phase === "start") {
          dragging = true;
          lastX = e.x;
          yawV = 0;
        } else if (e.phase === "move") {
          const dx = e.x - lastX;
          lastX = e.x;
          yaw -= dx * 0.008;
          yawV = -e.vx * 0.008;
        } else dragging = false;
      } else if (e.type === "tap") {
        if (waitNext) return next();
        const ndc = new THREE.Vector2((e.x / stage.width) * 2 - 1, -(e.y / stage.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects([...discs.values()].map((g) => g.children[0]))[0];
        if (hit && !walk) doTap(hit.object.userData.cell);
      } else if (e.type === "action") {
        if (waitNext) return void (e.action === "primary" && next());
        const groups = groupsOf(s.kinds);
        if (e.action === "left" || e.action === "right") selGroup = (selGroup + (e.action === "right" ? 1 : groups.length - 1) + (selGroup < 0 ? 1 : 0)) % groups.length;
        else if (e.action === "up" || e.action === "down") yaw += e.action === "up" ? 0.4 : -0.4;
        else if (e.action === "primary" && selGroup >= 0 && !walk) doTap(s.kinds.indexOf(groups[selGroup]));
      }
    });

    const show = (title: string, detail: string, hint: string) => {
      card.innerHTML = `<div style="font:700 24px system-ui;background:linear-gradient(90deg,#e9d5ff,#f9a8d4);-webkit-background-clip:text;background-clip:text;color:transparent">${title}</div><div style="margin-top:6px">${detail}</div>${hint ? `<div style="margin-top:8px;font:500 13px system-ui;opacity:.6">${hint}</div>` : ""}`;
    };
    let time = 0;
    return {
      update(dt) {
        time += dt;
        if (!dragging) {
          yaw += yawV * dt;
          yawV *= Math.pow(0.04, dt); // momentum decays
        }
        for (const [i, t] of spinT) {
          if (t + dt >= SPIN) spinT.delete(i);
          else spinT.set(i, t + dt);
        }
        if (walk) {
          walk.t += dt * WALK;
          if (walk.t >= walk.path.length - 1 && !waitNext && s.solved) {
            waitNext = !s.finished;
            if (s.finished) overIn = 2.4;
            shown = 1;
            emit({ type: "feel", kind: "score" });
          }
        }
        if (overIn > 0 && (overIn -= dt) <= 0) emit({ type: "over", score: s.score });
      },
      render() {
        if (builtFor !== s.level) build();
        const ins = insets();
        info.style.top = `${ins.top + 8}px`;
        info.textContent = `Level ${s.level} of ${LEVELS.length} · ${s.taps} tap${s.taps === 1 ? "" : "s"} left`;
        // Turnstiles swing into place; the selected group (keyboard) glows.
        const groups = groupsOf(s.kinds);
        for (const [i, d] of discs) {
          const t = spinT.get(i);
          d.rotation.y = t === undefined ? 0 : (Math.PI / 2) * Math.pow(1 - t / SPIN, 3);
          const mat = (d.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = selGroup >= 0 && s.kinds[i] === groups[selGroup] ? 0.9 : 0.25;
        }
        // The bot: idle at the start, or walking its route (a small hop per cell).
        let pos = at(s.start), dir = new THREE.Vector3(0, 0, 1), hop = 0;
        if (walk) {
          const k = Math.min(walk.path.length - 1, walk.t);
          const a = Math.floor(k), b = Math.min(walk.path.length - 1, a + 1), f = k - a;
          const pa = at(walk.path[a]), pb = at(walk.path[b]);
          pos = pa.clone().lerp(pb, f);
          if (b !== a) dir = pb.clone().sub(pa).normalize();
          hop = reducedMotion ? 0 : Math.sin(f * Math.PI) * 0.12;
        }
        bot.position.set(pos.x, 0.12 + hop + (reducedMotion ? 0 : Math.sin(time * 3) * 0.015), pos.z);
        bot.rotation.y = Math.atan2(dir.x, dir.z);
        if (beacon) {
          beacon.rotation.y = time * 1.5;
          beacon.position.y = 0.75 + (reducedMotion ? 0 : Math.sin(time * 2) * 0.06);
        }
        // Camera: orbit around the board, pulled back enough to frame it below the HUD.
        const span = Math.max(s.w, s.h) + 1.5;
        const dist = span * (camera.aspect < 0.8 ? 2.2 : 1.6) + 2;
        camera.position.set(Math.sin(yaw) * dist * 0.62, dist * 0.78, Math.cos(yaw) * dist * 0.62);
        camera.lookAt(0, -0.2 - (ins.top / Math.max(1, stage.height)) * 1.2, 0);
        key.position.set(4, 9, 5);
        key.target.position.set(0, 0, 0);

        card.style.opacity = String(shown);
        card.style.transform = `translate(-50%,-50%) scale(${reducedMotion ? 1 : 0.94 + 0.06 * shown})`;
        if (s.finished && shown) show("Every bot home", `All ${LEVELS.length} levels · ${s.score} points`, "");
        else if (waitNext) show("Home", `+${100 * s.level + 25 * s.taps}`, `Tap for level ${s.level + 1}`);
        else if (!s.alive) {
          shown = 1;
          show("Out of taps", `Level ${s.level} · ${s.score} points`, "");
        } else if (!walk) card.style.opacity = "0";
        renderer.render(scene, camera);
      },
      serialize: () => s,
      restore(data) {
        s = data as TurnState;
        builtFor = -1;
        walk = null;
        spinT = new Map();
        waitNext = s.solved && !s.finished;
        shown = s.solved || !s.alive ? 1 : 0;
        overIn = !s.alive || s.finished ? 0.6 : -1;
      },
      destroy() {
        off();
        info.remove();
        card.remove();
        stage.host.style.background = "";
      },
    };
  },
};

export default turnstile;
