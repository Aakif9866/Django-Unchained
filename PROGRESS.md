# Progress

## Session 1 (2026-11-20): Phase 1 foundation

**Done and verified**
- Scaffolded Next.js 16 + TypeScript + Tailwind v4 with a static export. Removed `cacheComponents` / `partialPrefetching`,
  which a static export doesn't need. Bumped `@types/node` to 22 so it matches Node 22 and satisfies Vitest's peer dependency.
- Engine: fixed-step loop, unified input (tap, swipe, drag with velocity, keys, two-finger pause), 2D and 3D stages, seeded
  RNG, IndexedDB snapshots, zustand store (settings, bests, history, recent), haptics + synthesized sounds (sound off by default).
- Shell: home (animated gradient backdrop, hold clock, hero with Resume, recently played, category chips, 32-card grid
  with "Soon" cards), full-screen game frame with HUD, frosted spring sheets (ready / paused / welcome back / game over /
  error), settings sheet, custom 404, web manifest, SVG icon, service worker.
- Call mode works: pauses on window blur, tab hide, Esc/P or two-finger touch; saves on pause, on `pagehide` and every 4 s;
  reloading shows "Welcome back" and resumes the exact run.
- **Coil** (snake, 2D): buffered turns, may follow its own tail, speed ramp, timed bonus, interpolated rendering, board fits the screen.
- **Glide** (stack tower, 3D): slicing, perfect-drop snap with halo, grows back after a perfect streak, falling debris, camera
  follows the tower and zooms out on game over.
- Results: `npm test` **17/17 pass** (Coil 10, Glide 7). `npm run e2e` **11/11 pass**: home, no horizontal scroll at
  360/768/1440, settings persist, pause + resume for both games, Coil game over, Glide scoring + game over, 404.
  tsc and eslint are clean, and `npm run build` prerenders all 36 routes.

**Visual fixes made after looking at screenshots**
- 3D colours were washed out: switched ACES to Neutral tone mapping, adjusted the lights, and made Glide's palette richer.
- The fullscreen button showed on phones, and the selected chip's text was invisible. Both came from unlayered CSS beating
  Tailwind. Moved the CSS into `@layer base` / `@layer components`.
- Glide's backdrop faded to olive; it now fades to violet.
- **Not yet re-checked:** the screenshot run after the last two fixes (layers, Glide backdrop) was interrupted. The
  e2e suite passed after those fixes, but nobody has looked at the images.

**Decisions / deviations from `docs/plan.md`**
- Imperative Three.js instead of R3F for games (R3F/drei/postprocessing installed, unused so far).
- Settings is a sheet on home, not a `/settings` route.
- Service worker is hand-written (`public/sw.js`) instead of Serwist, so there are no Turbopack compatibility worries. Offline mode isn't tested yet.

## Next up (start here on "continue")

1. Run `npx playwright test tests/shots.spec.ts` and look at `test-results/shots/*`. Confirm the chip and Glide fixes;
   polish anything that looks off (home "Soon" cards feel heavy: consider a separate "On the way" section).
2. Finish the Phase 1 gaps: gamepad input in `engine/input.ts`; automatic battery saver (Battery API, low and not
   charging); test offline mode against the built `out/`; optional light theme.
3. **Phase 2, Arcade 2D:** Flutter, Stack Fall (SRS + kicks, 7-bag, hold, ghost), Brickline, Orbit, Bubble, Rally,
   Fruit Slice. Follow "Adding a game" in `CLAUDE.md`.
4. Then Phases 3–7 as in `docs/plan.md`: 3D action, board games against AI (shared search, chess AI in a Web Worker,
   perft tests), puzzles, cards and tiles, polish (Lighthouse, 60 fps on a mid-range phone, README).

## Known limits

- Scores are played in the browser and stored locally, so they're easy to edit. That's fine with no leaderboard (v2).
- The two-finger pause only triggers on a second simultaneous touch, so a game that needs multitouch would need an opt-out.
- Not committed or pushed yet.
