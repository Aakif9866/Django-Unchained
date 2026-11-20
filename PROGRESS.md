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

## Session 2 (2026-11-20): Phase 1 gaps closed

**Done and verified**
- Committed Phase 1 as `852e2a0`.
- Re-checked the screenshots: the chip and Glide backdrop fixes are confirmed.
- Home: the 30 "Soon" games moved out of the big card grid into a compact **"On the way"** section: two-column rows,
  each with a full-colour gradient tile and a faint wash of the game's gradient over the dark background. The phone home
  page went from 4,883 px to 2,112 px tall.
- **Gamepad** in `engine/input.ts`: d-pad and left stick map to directions, A to primary, Start to pause. It emits only
  when a button is first pressed, and it polls only while a pad is connected.
- **Automatic battery saver** (`batterySaver()` in `engine/store.ts`): turns on when the user toggles it, or when the
  device is at 20% or lower and not charging (Battery API). The result is 30 fps and DPR 1.
- **Offline is now tested**: after one visit, the home page and a visited game load and play with the network off.
- Light theme skipped on purpose: the product is dark by default and the user asked for dark + colourful.
- **Flutter** (one-tap flyer, 2D, Phase 2 game 1): world is 100 units tall and the camera follows the bird. It hovers
  until the first flap, the ceiling is soft and the ground kills. Gaps never jump more than 30 units, so every run is
  reachable. Speed and gap size ramp, then cap. Zoom is capped by width so portrait phones still see ahead. Visuals: night
  sky, parallax stars and two gradient hill layers, glowing gradient pillars with lit caps, a gradient bird with a wing
  beat and tilt, flap puffs, and screen shake on a crash. Flaps fire on pointer-down.
- Results: `npm test` 26/26 (Flutter 9, including an autopilot that proves runs are beatable and a snapshot round-trip).
  `npm run e2e` 15/15, including offline, the stubbed gamepad and Flutter. tsc and eslint are clean. Screenshots checked.

**Gotcha:** `next build` sometimes reuses a stale CSS chunk from `.next/` (new rules in `globals.css` were missing from
`out/`). Run `rm -rf .next` before building whenever a CSS change doesn't show up.

## Session 3 (2026-11-20): Stack Fall

**Done and verified**
- **Stack Fall** (falling blocks, 2D): real SRS rotation (box rotation plus the full JLSTZ and I wall-kick tables),
  7-bag randomiser, hold (once per piece), ghost piece, 3-piece preview, lock delay of 0.5 s with up to 15 move-resets,
  guideline gravity curve (floored at 0.03 s), scoring of 100/300/500/800 × level plus 1 per soft-drop cell and 2 per
  hard-drop cell, a level every 10 lines, and both block-out and lock-out end the game.
- One-thumb controls: drag sideways and the piece follows column by column, drag down soft-drops, a fast flick down
  hard-drops, a flick up holds, and a tap rotates. Keys: ← → move, ↑ rotate, ↓ soft drop, Space hard drop, C/Shift hold.
- Visuals: glossy gradient blocks with a bevel and glow on the active piece, an outlined ghost in the piece's colour,
  a frosted well on a blue/pink glow, hold and next panels plus level and lines, a hard-drop trail and a line-clear flash.
- Input engine: new `secondary` action (C / Shift / gamepad B). Coil now accepts only directions as turns.
- Results: `npm test` 42/42 (Stack Fall 16: 7-bag, rotation cycle, I and T wall kicks, blocked rotation, gravity, lock
  delay and reset cap, ghost and hard drop, soft drop, line clears, levels, hold, game over, snapshot round-trip).
  `npm run e2e` 17/17. Screenshot checked and fixed (spawn now clipped to the well, more spacing under the strip).

**Simplified on purpose:** no T-spin bonus scoring and no DAS auto-repeat when a key is held (the input engine drops
key repeats). Add them if players ask.

## Session 4 (2026-11-20): Phase 2 finished (Arcade 2D)

**Done and verified** (each has logic tests, a smoke pause/resume test, and a screenshot that was looked at)
- Shared pieces: `input.isDown(action)` for held keys (paddles, steering), `fitWorld()` in `engine/stage.ts` (fits a
  world box into the play area), and a per-game loop in `tests/shots.spec.ts` (`SHOT=<id>` runs one game).
- **Brickline**: sub-stepped circle-vs-box collision (no tunnelling, tested at speed 400), 5 handmade levels plus
  mirrored generated ones, hit points 1–3, power-ups (wide / multi-ball / slow / extra life), a paddle angle that depends
  on where the ball lands, and 3 lives. An autopilot clears level 1 in the tests.
- **Orbit**: 120×160 wraparound world, a one-thumb stick (drag sets aim and thrust) with auto-fire, rocks that split
  3→2→1, waves that spawn away from the ship, and invulnerability after respawn. Objects are drawn across the seams.
- **Bubble**: offset hex grid whose parity flips when a row pushes in, wall-bounce aiming with a guide, flood fill for
  matches of three or more, floating clusters drop for a bonus, a new row every 5 misses, a danger line, and next/swap.
- **Rally**: an AI that predicts the ball through wall bounces but only re-reads it every `reaction` seconds and aims
  with an error. Matches go to 7 and must be won by 2; each match won makes the AI sharper, and losing one ends the run.
- **Fruit Slice**: arcs that always peak on screen, swipe-segment slicing, bombs, 3 lives, combos, halves split along
  the cut, juice, and a blade trail. Checked with a mouse-swipe screenshot.
- Results: `npm test` 92/92, smoke 21/21, tsc and eslint clean.

## Session 5 (2026-11-20): Phase 3, 3D action (mostly done)

**Done and verified** (logic tests, smoke pause/resume, screenshot looked at)
- Shared: `runner-core.ts` (lanes, jump/roll, four obstacle kinds, a safe-lane generator with a no-trap rule) and
  `runner-view.ts` (chase camera, pooled meshes, player model). A bot survives 60 s on 4 seeds in each runner.
- **Rail Dash** (neon rail yard: trains, barriers, coins, magnet) and **Ridge Run** (winding sunset cliff path:
  rocks, logs, branches, gaps, gems).
- **Puck**: air hockey with sub-stepped circle physics, an AI that guards and strikes, matches to 7, and a table texture
  that shows the score.
- **Hop**: road / river / rail / grass lanes, logs that carry you, warned trains, a camera that keeps you moving. The
  view mirrors x so screen directions match input.
- **Pocket Golf**: 9 holes with walls, slopes, sand and water; a searching bot sinks every hole within par + 3.
- **Labyrinth**: depth-first mazes that grow each level, holes only in dead ends off the solution, drag or gyroscope tilt.
- **Drift**: spline track, slip physics, checkpoints that only count going forward, 3-lap time attack, and a ghost
  saved to localStorage.
- The Glide smoke test was made robust (a first drop can miss under load).

**Not yet verified:** **Helix Drop**. Logic tests pass (10) and it's registered, but the user stopped the run before
its smoke test and screenshot. Check it first.

**Results at stop:** `npm test` 161 passing (Helix included); smoke was 28/28 before Helix was added. Nothing committed
since `852e2a0`.

**v2 plan saved:** `docs/v2-plan.md` (guests and accounts, profiles and settings sync, friends, DMs and group chat,
real-time multiplayer, Redis, DevOps).

## Session 6 (2026-11-20): Helix Drop verified, Phase 4 (board games) done

**Done and verified** (logic tests, smoke tests, screenshots looked at on a phone, at 360 px and at 1440 px)
- **Helix Drop** passes its smoke test. The screenshot showed a light pink backdrop that clashed with every other game,
  so it now has a dark backdrop tinted per level (like Glide), vivid slightly emissive rings that shade down the tower,
  and a whiter pillar.
- **Shell fix (all games):** the closing scrim and sheet swallowed touches for about 250 ms after Play or Resume. Exiting
  sheets now ignore pointer events. Checked both ways: a drag 60 ms after Play failed before the fix and passes after.
- `search.ts`: one negamax with alpha-beta, iterative deepening, an optional quiescence pass and root "noise" for
  the lower levels. Moves are numbers; the clock and randomness are injected, so tests are exact.
- `kit.ts` (first written as `versus.ts`): the Worker bridge (asks once, plays the reply after a 0.45 s beat, only counts
  time while playing). It falls back to the main thread if the worker fails, and logs a console error when it does,
  so the smoke tests (which fail on any console error) prove the Worker really ran. Also the result banner, strip pills
  and thinking dots, shared by all the turn-based games.
- **Gambit** (chess): full rules (castling, en passant, a promotion picker, mate, stalemate, 50-move, threefold,
  insufficient material). Perft matches the reference counts (start to depth 4, Kiwipete to 3, positions 3/4/5).
  The engine uses piece-square tables, a mop-up term so it actually mates, captures first, and quiescence.
  Levels: Novice (depth 1, no quiescence, lots of noise), Club (2), Expert (3, about 10 ms), Master (up to depth 8 in
  1.5 s, reaching 5–6 on this Mac). Original vector pieces. Tap-tap (the second tap commits on press) or drag with the
  grab offset kept, a slide animation, a keyboard cursor, and two-step resign (button, or C twice). The board turns
  around when you play Black.
- **Four Up**: 69 precomputed lines, centre-first ordering, a line-window evaluation, and Master searching up to depth
  16 in 1.2 s. Discs fall behind a frame with real holes, bounce once, and buzz when they land (not when released).
  Your disc waits above the board, follows your finger, and drops on release.
- **Reversi**: automatic passes with a message, end detection, weighted squares plus mobility, and an exact endgame
  (Expert at 8 or fewer empties, Master at 12 or fewer within its budget). Flips ripple outward from the new disc.
  A ghost disc shows on press, and you can slide off a square to cancel.
- **Ladder** for all three: a win starts the next game against a stronger level (colours or first move swap), a draw
  scores and keeps the level, a loss or resign ends the run. Points: your captures/flips × level during play;
  win 300 (Four Up: 200 plus a bonus for a quick win) × level; draw 100 × level.
- Board games stop repainting while nothing moves (a short "hot" timer), so a still board costs no battery on a call.
  Each one sets `data-ply` on the stage host so e2e can see moves.
- Results: `npm test` **201/201** (Gambit 20, Four Up 11, Reversi 9 new). `npm run e2e` **57/57**, including a test per
  board game that your move gets an engine reply from a real Web Worker, and Gambit resign → game over.
  tsc and eslint are clean, and a clean build exports the worker chunks.

**Simplified on purpose:** the chess search has no transposition table, no repetition check (a winning engine can
walk into a threefold draw) and no check extensions; add Zobrist hashing + a TT if Master needs more strength.
Reversi doesn't relax the X/C-square penalties once a corner is taken. There's no takeback, because it would let you
game the ladder.

**Started after that checkpoint, NOT verified yet** (the user stopped the session here)
- **Twenty48** (Phase 5, game 1): `logic.ts` + 8/8 tests pass (merging once per move, all four directions, no-op moves,
  2048 flag, game over, undo, snapshot round-trip). Undo steps back one move and rewinds the RNG, so the same move
  spawns the same tile (no fishing). `index.ts` is written: one move per swipe, committed when the swipe is recognised;
  slide, then a merge pop and spawn scale-in; an Undo button under the board (C on the keyboard); a "2048!" toast; a
  "No moves left" banner, then game over. It's registered (registry, glyph, `PLAYABLE`, disabled count 11, shot keys),
  but it has **not** been smoke-tested or looked at on screen yet.
- Renamed `src/games/versus.ts` → `src/games/kit.ts`; the imports are updated. Added the loud Worker fallback (above).
- Found: `next build` also copies each `ai.worker.ts` source file into `out/_next/static/media/`. Those copies are
  unused: the built game code calls Turbopack's worker loader (`e.r(…)(Worker)`), which starts the bundled
  `turbopack-worker-*.js` chunk. Added `"out"` to `tsconfig.json` `exclude`, because those `.ts` copies broke `tsc`.
- The full suite has not been re-run since these changes (last green: 201 unit tests and 57 e2e, before Twenty48).

## Next up (start here on "continue")

1. Finish verifying the end of session 6:
   - Kill any leftover dev server first: `lsof -ti:4310 | xargs kill`.
   - Run `npx tsc --noEmit && npx eslint src tests && npm test` (expect 209), then `rm -rf .next out && npm run build`,
     then `npm run e2e`. The three "engine replies from its Web Worker" tests must still pass now that a failing worker
     logs an error.
   - Look at `test-results/shots/twenty48.png` (tiles, Undo button, info pill). Twenty48 is done once that's good.
2. Phase 5, the rest: Minefield, Lights Out, Nine, Crates, Pipe Flow, Nonogram, then Turnstile (3D). Decide how
   puzzles without a natural fail state end a run, because a best score is only recorded on `over`. Ideas: lives
   for mistakes (Nine, Nonogram), a move budget (Lights Out, Pipe Flow), and for Crates a level pack or an "end run"
   button.
3. Phase 6, cards and tiles: Solitaire, Pairs, Tiles, Word Hunt. Phase 7: polish (Lighthouse, perf, README; decide
   whether to drop the unused R3F/drei/postprocessing packages; maybe stop the raw `ai.worker.ts` copies in `out/`).

**Adding a game quickly:** write logic + tests + index, then register (registry `load` + controls, a GameIcon glyph,
`PLAYABLE` and the disabled count in `tests/smoke.spec.ts`, a key list in `tests/shots.spec.ts`).
**Fast visual loop:** `npx next dev -p 4310`, then `SHOT=<id> npx playwright test tests/shots.spec.ts` reuses it.
Kill it (`lsof -ti:4310 | xargs kill`) before `npm run e2e`, or the suite runs against dev instead of `out/`.

## Known limits

- Scores are played in the browser and stored locally, so they're easy to edit. That's fine with no leaderboard (v2).
- The two-finger pause only triggers on a second simultaneous touch, so a game that needs multitouch would need an opt-out.
- The offline cache only holds pages that have been visited. A game never opened while online won't load offline.
- Stack Fall has no T-spin bonus scoring.
