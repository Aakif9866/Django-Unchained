/** Render surfaces. 2D games get a DPR-scaled canvas; 3D games get a shared Three.js rig. */
import * as THREE from "three";

interface Base {
  host: HTMLElement;
  width: number; // CSS px
  height: number;
  onResize(fn: () => void): () => void;
  destroy(): void;
}
export interface CanvasStage extends Base {
  kind: "2d";
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}
export interface ThreeStage extends Base {
  kind: "3d";
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** Shared studio key light: games move it to follow the action. */
  key: THREE.DirectionalLight;
}
export type Stage = CanvasStage | ThreeStage;

function watch(host: HTMLElement, apply: (w: number, h: number) => void) {
  const subs = new Set<() => void>();
  const ro = new ResizeObserver(() => {
    apply(host.clientWidth, host.clientHeight);
    subs.forEach((fn) => fn());
  });
  ro.observe(host);
  apply(host.clientWidth, host.clientHeight);
  return {
    onResize(fn: () => void) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    stop: () => ro.disconnect(),
  };
}

export function createCanvasStage(host: HTMLElement, maxDpr: number): CanvasStage {
  const canvas = document.createElement("canvas");
  canvas.className = "stage-surface";
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const stage = { kind: "2d", host, canvas, ctx, width: 0, height: 0 } as CanvasStage;
  const w = watch(host, (width, height) => {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    stage.width = width;
    stage.height = height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // games draw in CSS px
  });
  stage.onResize = w.onResize;
  stage.destroy = () => {
    w.stop();
    canvas.remove();
  };
  return stage;
}

export function createThreeStage(host: HTMLElement, maxDpr: number): ThreeStage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "stage-surface";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe8ecff, 0x2a1840, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(6, 12, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  const stage = { kind: "3d", host, renderer, scene, key, width: 0, height: 0 } as ThreeStage;
  const w = watch(host, (width, height) => {
    stage.width = width;
    stage.height = height;
    renderer.setSize(width, height, false);
  });
  stage.onResize = w.onResize;
  stage.destroy = () => {
    w.stop();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mat) => mat.dispose());
    });
    renderer.dispose();
    renderer.domElement.remove();
  };
  return stage;
}

/** Fit a w×h world into the play area (below the HUD, above the home indicator). World → screen: x + wx·k. */
export function fitWorld(stage: { width: number; height: number }, ins: { top: number; bottom: number }, w: number, h: number, pad = 12) {
  const availW = stage.width - pad * 2;
  const availH = stage.height - ins.top - ins.bottom - pad * 2;
  const k = Math.max(0.1, Math.min(availW / w, availH / h));
  return { k, x: (stage.width - w * k) / 2, y: ins.top + pad + (availH - h * k) / 2 };
}
