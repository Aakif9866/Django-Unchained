# ON HOLD: task brief and handoff

@AGENTS.md

**Branch:** `new-project` (orphan, separate from `main` = Django Unchained and `10-projects` = SIDEQUEST).
**Status (2026-11-20):** Phase 1 mostly done, nothing committed yet. When the user says **"continue"**, read
`PROGRESS.md` → "Next up" and carry on from there.

## The product

**On Hold: games for the in-between.** An arcade of 32 polished single-player games you can play with one thumb while
on a phone call. Full approved plan: `docs/plan.md` (game list, phases, design, verification).

**Hard requirements from the user**
- All **32 games** in `src/games/registry.ts` get built. Each is full screen, fully responsive, and has a real engine
  (pure rules in `logic.ts` with tests), not something that barely works.
- No backend and no database. Saved state stays on the device (localStorage + IndexedDB). DB, multiplayer and sharing
  are **v2** (backlog in `docs/plan.md`).
- **Looks come before everything else.** Follow the `apple-design` skill (load it before UI work): springs,
  interruptible motion, frosted materials, press feedback on pointer-down, reduced motion. **Dark by default, colourful
  gradients.** 3D where it helps (hybrid).
- The unique hook is **call mode**: one-thumb controls, instant pause + IndexedDB snapshot on blur / tab hide /
  two-finger touch / Esc, exact resume after reload, silent by default with haptics on, battery saver.
- Original names and art only. Games inspired by famous titles copy the genre, never the name or look. Renamed for
  trademarks: Pong → Rally, Connect Four → Four Up, Sokoban → Crates, Mahjong Solitaire → Tiles.

## Stack (decided, don't relitigate)

Next.js 16 App Router + TypeScript, `output: "export"` (fully static, deploy to Vercel), Tailwind v4, `motion/react`,
Three.js, zustand (persist), idb-keyval, Vitest, Playwright (system Chrome via `channel: "chrome"`).
- **Next 16 differs from training data.** Read `node_modules/next/dist/docs/` before using a Next API (see AGENTS.md).
- `@react-three/fiber`, `drei` and `postprocessing` are installed but **unused**. Games use imperative Three.js
  through `createThreeStage`, because a fixed-step game loop fits it better. Use R3F only for shell decoration, or
  remove those packages at the end if they're still unused.
- Node 22. Use npm. (The global "always uv" rule is for Python; this project has no Python.)

## Architecture

```
src/engine/   loop.ts (fixed 1/60 step + render alpha, fps cap)   input.ts (tap/swipe/drag+velocity, keys, 2-finger pause)
              stage.ts (2D canvas DPR stage | Three.js stage with shared lighting rig)   rng.ts (mulberry32, snapshotable)
              snapshot.ts (IndexedDB saves)   store.ts (zustand: settings, bests, history, recent)   feedback.ts (haptics + synth sfx)
              types.ts (the Game contract)
src/games/    registry.ts (all 32 metas; `load` set only for playable ones)   <id>/logic.ts + logic.test.ts + index.ts
src/shell/    Home, GameFrame (call-mode runtime), Sheet, SettingsSheet, GameIcon, HoldClock, Providers
src/app/      page.tsx (home), play/[id]/page.tsx (generateStaticParams for all 32), not-found, manifest.ts, layout
public/       sw.js (stale-while-revalidate offline cache), icon.svg
tests/        smoke.spec.ts (browser checks), shots.spec.ts (screenshots → test-results/shots, for visual review)
```

**Adding a game** (the repeating pattern for phases 2–6):
1. `src/games/<id>/logic.ts`: pure rules and state as plain JSON-safe objects, using only the injected `Rng`. No DOM, no `Date`.
2. `logic.test.ts`: the rules, edge cases, and a snapshot round-trip (`JSON.parse(JSON.stringify(state))` behaves the same).
3. `index.ts`: default-export a `GameModule` (`kind: "2d" | "3d"`, `create(env)`). It returns `update(dt)`, `render(alpha)`,
   `serialize()`, `restore()` and `destroy()`. It emits `score`, `feel` and `over` events. It respects `env.insets()` (HUD
   area) and `env.reducedMotion`. Render must rebuild everything from state, so restore just works.
4. Set `load: () => import("./<id>")` and `controls` in `registry.ts`, add a glyph in `shell/GameIcon.tsx`, and add the id to
   `PLAYABLE` in `tests/smoke.spec.ts`. Update the smoke counts (32 cards, N disabled).
5. Bump that game's `version` in the registry whenever `serialize()` changes shape.

**CSS gotcha:** custom classes live in `@layer components` and element rules in `@layer base` in `globals.css`.
Unlayered CSS beats Tailwind utilities and breaks things (`hidden sm:grid`, chip colours). Keep new CSS in a layer.

## Commands

```bash
npm install
npm run dev                # http://localhost:3000
npm test                   # Vitest: all logic tests
npx tsc --noEmit && npx eslint src
npm run build              # static export to out/
npm run e2e                # builds must exist: serves out/ on :4310, runs Playwright with system Chrome
npx playwright test tests/shots.spec.ts   # screenshots → test-results/shots/ ; look at them after visual changes
```

## Working rules

- Keep it simple: no new dependency or abstraction when the stack covers it. The Game contract is the only abstraction.
- Never fabricate results. A game counts as done only when its logic tests and smoke test pass and its screenshot has
  been looked at. Report failures as they are.
- Commit or push only when asked. Nothing has been committed on this branch yet.
- The repo root holds untracked SIDEQUEST leftovers (`accounts/ apps/ config/ core/ e2e/ .venv db.sqlite3 .env`).
  They're gitignored. Don't delete them without asking.
- Keep `PROGRESS.md` updated at the end of every session.
