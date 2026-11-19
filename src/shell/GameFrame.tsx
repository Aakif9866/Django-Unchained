"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { feel } from "@/engine/feedback";
import { createInput, type Input } from "@/engine/input";
import { createLoop, type Loop } from "@/engine/loop";
import { createRng, type Rng } from "@/engine/rng";
import { clearSnapshot, loadSnapshot, saveSnapshot, type Snapshot } from "@/engine/snapshot";
import { createCanvasStage, createThreeStage, type Stage } from "@/engine/stage";
import { useStore } from "@/engine/store";
import type { GameEvent, GameInstance, GameModule } from "@/engine/types";
import { getGame, gradientCss } from "@/games/registry";
import { Sheet } from "./Sheet";

type Phase = "loading" | "ready" | "playing" | "paused" | "over" | "error";
interface Runtime {
  stage: Stage;
  input: Input;
  rng: Rng;
  loop: Loop;
  game: GameInstance;
}

const AUTOSAVE_MS = 4000;
const noop = () => () => {};

export function GameFrame({ id }: { id: string }) {
  const meta = getGame(id)!;
  const hostRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const mod = useRef<GameModule | null>(null);
  const rt = useRef<Runtime | null>(null);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>("loading");
  const [phase, setPhaseState] = useState<Phase>("loading");
  const [score, setScore] = useState(0);
  const [resumed, setResumed] = useState<number | null>(null); // minutes since the saved run, when we came back to one
  const [result, setResult] = useState<{ score: number; best: number; isBest: boolean } | null>(null);
  const fsSupported = useSyncExternalStore(noop, () => !!document.fullscreenEnabled, () => false);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const onOver = useCallback(
    (final: number) => {
      const r = rt.current;
      if (!r) return;
      r.input.enabled = false;
      setPhase("over");
      void clearSnapshot(id);
      const prevBest = useStore.getState().bests[id] ?? 0;
      const isBest = useStore.getState().recordRun(id, final);
      setResult({ score: final, best: Math.max(prevBest, final), isBest });
      // Let the crash animation play out before freezing the frame.
      setTimeout(() => {
        if (phaseRef.current === "over") r.loop.stop();
      }, 1400);
    },
    [id, setPhase],
  );

  const save = useCallback(() => {
    const r = rt.current;
    if (!r || (phaseRef.current !== "playing" && phaseRef.current !== "paused")) return;
    const snap: Snapshot = { v: meta.version, at: Date.now(), rng: r.rng.state(), game: { g: r.game.serialize(), score: scoreRef.current } };
    void saveSnapshot(id, snap);
  }, [id, meta.version]);

  const shutdown = () => {
    const r = rt.current;
    if (!r) return;
    r.loop.stop();
    r.game.destroy();
    r.input.destroy();
    r.stage.destroy();
    rt.current = null;
  };

  const boot = useCallback(
    (snap: Snapshot | null) => {
      const host = hostRef.current;
      const m = mod.current;
      if (!host || !m) return;
      shutdown();
      const { battery } = useStore.getState().settings;
      const maxDpr = battery ? 1 : 2;
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const input = createInput(host);
      const rng = createRng();
      const insets = () => ({
        top: hudRef.current?.offsetHeight ?? 64,
        bottom: (probeRef.current?.offsetHeight ?? 0) + 12,
      });
      const emit = (e: GameEvent) => {
        if (e.type === "score") {
          scoreRef.current = e.value;
          setScore(e.value);
        } else if (e.type === "feel") feel(e.kind);
        else if (e.type === "over") onOver(e.score);
      };
      let stage: Stage;
      let game: GameInstance;
      if (m.kind === "2d") {
        const s = createCanvasStage(host, maxDpr);
        stage = s;
        game = m.create({ stage: s, input, rng, emit, insets, reducedMotion });
      } else {
        const s = createThreeStage(host, maxDpr);
        stage = s;
        game = m.create({ stage: s, input, rng, emit, insets, reducedMotion });
      }
      if (snap) {
        rng.setState(snap.rng);
        const saved = snap.game as { g: unknown; score: number };
        game.restore(saved.g);
        scoreRef.current = saved.score;
        setScore(saved.score);
      } else {
        scoreRef.current = 0;
        setScore(0);
      }
      const loop = createLoop(
        (dt) => game.update(dt),
        (a) => game.render(a),
        () => (useStore.getState().settings.battery ? 30 : 60),
      );
      rt.current = { stage, input, rng, loop, game };
      // Paint one frame so the board shows behind the start / resume sheet.
      requestAnimationFrame(() => rt.current?.game.render(0));
    },
    [onOver],
  );

  const play = useCallback(() => {
    const r = rt.current;
    if (!r) return;
    useStore.getState().touch(id);
    r.input.enabled = true;
    r.loop.start();
    setPhase("playing");
  }, [id, setPhase]);

  const pause = useCallback(() => {
    const r = rt.current;
    if (!r || phaseRef.current !== "playing") return;
    r.loop.stop();
    r.input.enabled = false;
    setPhase("paused");
    save();
  }, [save, setPhase]);

  const restart = () => {
    void clearSnapshot(id);
    setResumed(null);
    setResult(null);
    boot(null);
    play();
  };

  // Load the game module and any saved run.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!meta.load) throw new Error("not playable yet");
        const [m, snap] = await Promise.all([meta.load(), loadSnapshot(id, meta.version)]);
        if (cancelled) return;
        mod.current = m.default;
        boot(snap);
        if (snap) {
          setResumed(Math.max(1, Math.round((Date.now() - snap.at) / 60000)));
          setPhase("paused");
        } else setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      save();
      shutdown();
    };
  }, [id, meta, boot, save, setPhase]);

  // Call mode: anything that takes you away pauses and saves.
  useEffect(() => {
    const onHide = () => (document.hidden ? pause() : undefined);
    const onBlur = () => pause();
    const onPageHide = () => save();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    const auto = setInterval(() => phaseRef.current === "playing" && save(), AUTOSAVE_MS);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      clearInterval(auto);
    };
  }, [pause, save]);

  // Pause from the game's own input (Esc, P, two-finger touch).
  useEffect(() => {
    if (phase !== "playing") return;
    return rt.current?.input.on((e) => {
      if (e.type === "action" && e.action === "pause") pause();
    });
  }, [phase, pause]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const best = useStore((s) => s.bests[id] ?? 0);

  return (
    <main className="frame">
      <div ref={hostRef} className="stage-host" aria-label={`${meta.name} game area`} />
      <div ref={probeRef} className="safe-probe" aria-hidden />

      <div ref={hudRef} className="hud">
        <Link href="/" className="icon-btn material" aria-label="Back to library">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="hud-pill material min-w-0">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundImage: gradientCss(meta) }} aria-hidden />
          <span className="t-headline truncate text-[0.9375rem]">{meta.name}</span>
        </div>
        <div className="flex-1" />
        <div className="hud-pill material" aria-live="polite" aria-label={`Score ${score}`}>
          <span className="t-score text-xl">{score}</span>
        </div>
        {fsSupported && (
          <button className="icon-btn material hidden sm:grid" onClick={toggleFullscreen} aria-label="Toggle full screen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <button className="icon-btn material" onClick={pause} disabled={phase !== "playing"} aria-label="Pause">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1.2" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" />
          </svg>
        </button>
      </div>

      {phase === "loading" && <div className="absolute inset-0 grid place-items-center t-caption">Loading {meta.name}…</div>}

      <Sheet open={phase === "error"} label="Game unavailable">
        <h2 className="t-title">{meta.name} isn&apos;t ready yet</h2>
        <p className="t-body mt-1 mb-5">It&apos;s on the way. Pick another game for now.</p>
        <Link href="/" className="btn btn-cta w-full">Back to library</Link>
      </Sheet>

      <Sheet open={phase === "ready"} label={`Start ${meta.name}`}>
        <h2 className="t-title">{meta.name}</h2>
        <p className="t-body mt-1">{meta.tagline}</p>
        <p className="t-caption mt-3 mb-5">{meta.controls} · Two-finger tap or Esc pauses</p>
        <button className="btn btn-cta w-full" onClick={play}>Play</button>
        {best > 0 && <p className="t-caption mt-3 text-center">Your best: {best}</p>}
      </Sheet>

      <Sheet open={phase === "paused"} onDismiss={play} label="Paused">
        <h2 className="t-title">{resumed ? "Welcome back" : "Paused"}</h2>
        <p className="t-body mt-1 mb-5">
          {resumed ? `Your run is right where you left it, ${resumed} min ago. Score ${score}.` : `Score ${score}. Your game is saved.`}
        </p>
        <div className="flex flex-col gap-2.5">
          <button className="btn btn-cta w-full" onClick={() => { setResumed(null); play(); }}>Resume</button>
          <div className="flex gap-2.5">
            <button className="btn flex-1" onClick={restart}>Restart</button>
            <Link href="/" className="btn flex-1">Library</Link>
          </div>
        </div>
      </Sheet>

      <Sheet open={phase === "over"} label="Game over">
        <div className="t-caption uppercase">{result?.isBest ? "New personal best" : "Game over"}</div>
        <div className={`t-score mt-1 text-6xl ${result?.isBest ? "brand-text" : ""}`}>{result?.score ?? 0}</div>
        <p className="t-body mt-1 mb-5">Best {result?.best ?? best}</p>
        <div className="flex gap-2.5">
          <button className="btn btn-cta flex-1" onClick={restart}>Play again</button>
          <Link href="/" className="btn flex-1">Library</Link>
        </div>
      </Sheet>
    </main>
  );
}
