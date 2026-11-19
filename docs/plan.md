# ON HOLD: an arcade for the in-between

## Context
The Snake app in SIDEQUEST made the user want a whole arcade. Specifically, they want something to play while on a phone call, because online games are buggy and don't have the vibe they like. Requirements:
- 20 or more single-player games, each playable full screen
- fully responsive
- no backend or database: all saved state stays on the device
- a real engine behind every game, not something that barely works
- looks come before everything else: Apple-style design, and 3D where it helps

Database, multiplayer and sharing are deferred to v2. Everything is built on the empty orphan branch `new-project`.

**Decisions made:** Next.js (App Router) + TypeScript, deployed to Vercel, with no Django. A hybrid of 3D and 2D. The "On Hold" call mode is the unique hook. The visual style is Apple design, dark mode by default, with colourful gradients.

## The unique hook: call mode
Every game is built for playing with one hand while you're on the phone:
- **One-thumb play:** every game works with a single thumb in portrait. Keyboard and gamepad also work on desktop.
- **Instant pause and resume:** the game freezes when the tab is hidden, loses focus, or the screen is touched with a second finger. It saves a full snapshot of its state to IndexedDB, then resumes from exactly that frame, even after the browser is closed.
- **Silent by default:** feedback comes through haptics (`navigator.vibrate`) and visuals. Sound is opt-in and ducks quietly.
- **Short rounds:** every game has a quick 30-second to 3-minute mode alongside its endless mode.
- **"Hold timer" home screen:** a calm pocket-console home with a running session clock, a "continue where you left off" shelf, and one tap into the last game.
- **Battery aware:** the frame rate drops to 30 fps and post-processing turns off when the device is on battery saver or has reduced-motion set.

## Game catalogue: all 32 are in scope
All names, art and levels are original. Games inspired by famous titles copy the genre and mechanics, never their branding. (The ⭐ marks are left over from the first draft and don't affect scope.)

| # | Game (working name) | Genre / inspired by | Render | Engine notes |
|---|---|---|---|---|
| 1 ⭐ | **Coil** | Classic snake | 2D | Grid tick loop, input queue, wall-wrap mode |
| 2 ⭐ | **Ridge Run** | Toned-down endless runner (Temple Run-like) | 3D | Swipe lanes, gentle speed curve, procedural track chunks |
| 3 ⭐ | **Rail Dash** | 3-lane dodger (Subway Surfers-like) | 3D | Jump/roll/lane, obstacle pattern generator, coin magnet |
| 4 ⭐ | **Flutter** | One-tap flyer (Flappy-like) | 2D | Fixed-timestep physics, seeded gaps |
| 5 ⭐ | **Puck** | Air hockey against AI | 3D | Circle physics with restitution, 3 AI levels |
| 6 ⭐ | **Turnstile** | Rotate-the-world puzzle (Mekorama-like) | 3D | Voxel levels, A* pathing for the robot, 20 handmade levels |
| 7 ⭐ | **Gambit** | Chess against AI | 2D/3D board | Full rules (castling, en passant, promotion, draws), alpha-beta + iterative deepening running in a Web Worker so the UI never stalls, 4 difficulty levels, perft-tested against known node counts |
| 8 ⭐ | **Stack Fall** | Falling blocks (Tetris-like) | 2D | SRS rotation + wall kicks, 7-bag, hold, ghost piece |
| 9 ⭐ | **Brickline** | Breakout | 2D | Swept-circle collision, power-ups, level data |
| 10 ⭐ | **Twenty48** | 2048 merge | 2D | Pure state reducer, undo |
| 11 ⭐ | **Minefield** | Minesweeper | 2D | First click always safe, flood fill, chording |
| 12 ⭐ | **Nine** | Sudoku | 2D | Generator that guarantees a unique solution, difficulty grading |
| 13 ⭐ | **Labyrinth** | Tilt maze | 3D | Gyroscope or drag tilt, rolling-ball physics, DFS-generated mazes |
| 14 ⭐ | **Orbit** | Asteroids-style shooter | 2D | Wraparound world, vector ships, one-thumb twin-stick |
| 15 ⭐ | **Hop** | Road-crossing hopper | 3D | Procedural lanes, tile-step movement |
| 16 ⭐ | **Pocket Golf** | Mini golf | 3D | Ball and slope physics, drag-to-shoot, 9 holes |
| 17 ⭐ | **Solitaire** | Klondike | 2D | Drag and drop, auto-move, solvable-deal check |
| 18 ⭐ | **Pairs** | Memory match | 2D | Seeded shuffle, timed mode |
| 19 ⭐ | **Bubble** | Bubble shooter | 2D | Hex grid, wall bounces, cluster pop |
| 20 ⭐ | **Glide** | Stack the tower (slicing blocks) | 3D | Overlap slicing, perfect-drop combo |
| 21 | Pong Zen | Pong against AI | 2D | Paddle AI with reaction delay |
| 22 | Reversi | Othello against AI | 2D | Minimax with mobility heuristic |
| 23 | Connect Four | Against AI | 2D | Negamax |
| 24 | Word Hunt | Boggle-style word search | 2D | Trie dictionary bundled offline |
| 25 | Pipe Flow | Pipe-rotation puzzle | 2D | Generator with a guaranteed solution |
| 26 | Lights Out | Toggle puzzle | 2D | Solvability via linear algebra over GF(2) |
| 27 | Sokoban | Box pushing | 2D | Level format, undo stack |
| 28 | Drift | Top-down racer against ghost laps | 3D | Arcade car physics, local ghost replay |
| 29 | Fruit Slice | Swipe-to-slice | 2D | Swipe trail hit tests |
| 30 | Helix Drop | Ball through a rotating tower | 3D | Ring generation, gap collisions |
| 31 | Nonogram | Picross | 2D | Line solver to check uniqueness |
| 32 | Mahjong Solitaire | Tile matching | 2D | Solvable layout generator |


## Stack and architecture
- **Next.js (App Router) + TypeScript**, using `output: 'export'`, so the build is fully static. Deploy by connecting the repo to **Vercel**, with no server setup. The same output also works on any static host.
- **Shell UI:** React, Tailwind CSS v4 (colours and spacing come from CSS-variable tokens), and **Motion** (`motion/react`) for interruptible spring animations and shared-layout card-to-full-screen transitions.
- **3D:** Three.js through **React Three Fiber** + **drei** (environment lighting, soft shadows), with **@react-three/postprocessing** for bloom on the gradient glows.
- **2D games:** a Canvas 2D stage driven by the engine loop. React only mounts the canvas; the game loop never re-renders React.
- **State and storage:** **Zustand** with its `persist` middleware for settings and best scores in `localStorage`, plus `idb-keyval` (IndexedDB) for game snapshots and history. No server and no database.
- **PWA:** a Next.js `app/manifest.ts` plus a small service worker (Serwist) for offline play and installing to the home screen.
- **Routes:** `/` (home), `/play/[id]` (full-screen game, statically generated for all 32 IDs with `generateStaticParams`), `/settings`.
- **Code layout:** the tree below sits under `src/`. Next.js pages live in `src/app/`, and each game's `index.ts` is loaded with `next/dynamic` and `ssr: false`.

```
src/
  engine/          # shared by every game
    loop.ts        # fixed-timestep update + interpolated render, pause/resume
    input.ts       # unified gestures (tap/swipe/drag/tilt) + keys + gamepad → actions
    snapshot.ts    # serialize/restore game state → IndexedDB (call mode core)
    rng.ts         # seeded PRNG (mulberry32) for deterministic games
    store.ts       # bests, history, settings
    haptics.ts audio.ts
    three/stage.ts # shared Three.js scene: renderer, lighting rig, palette, resize, DPR cap
    canvas/stage.ts# shared 2D stage: DPR scaling, letterbox, theme tokens
  shell/           # home, library grid, game frame (full screen, pause sheet, results)
  games/<id>/
    index.ts       # implements Game interface: init, update(dt), render(alpha), serialize, restore
    logic.ts       # pure rules (no DOM) → unit tested
    logic.test.ts
  styles/tokens.css
```

**Game contract:** every game exports `{ id, meta, create(stage, input, rng) }`, which returns `update`, `render`, `serialize` and `restore`. Rules live in a pure `logic.ts` with no DOM access, so they can be unit tested. A single registry array feeds the home screen. This one contract is the only abstraction, and every game uses it.

## Design (apple-design skill, loaded before building any UI)
- **Dark mode by default** (near-black layered surfaces) with an optional light theme. Frosted "material" sheets for pause and results (`backdrop-filter`), SF-style type scale (system-ui), and generous spacing.
- **Colourful gradients:** each game has a two- or three-stop gradient used on its card, icon diorama glow, results sheet and the bloom in its 3D scene. The home screen has a slow, animated mesh-gradient backdrop (paused when reduced motion is set). Text always sits on solid or frosted surfaces, never directly on a gradient, so it stays AA-readable.
- Spring physics for every transition, all interruptible. Game cards expand into full screen with a shared-element animation. Bottom sheets can be dragged down to dismiss.
- **Tactile** feel: press-down scale on buttons, haptic ticks, and an icon tile per game rendered as a small 3D diorama.
- Each game gets one signature hue. All 3D games share one soft studio lighting rig, so they feel like one product.
- Safe-area insets, `100dvh`, and layouts for both portrait and landscape. Works from 320px wide up to desktop. Honours `prefers-reduced-motion`. WCAG AA contrast for all interface text.

## Phases
1. **Foundation:** `create-next-app` (TypeScript, Tailwind, App Router, src dir), static-export config, `.gitignore` (excluding the SIDEQUEST leftovers), engine core (loop, input, snapshot, rng, store, both stages), shell (home, library, full-screen frame, pause and results sheets), PWA setup. Proof of the pipeline: **Coil** (2D) and **Glide** (3D), with call-mode pause and resume working.
2. **Arcade 2D:** Flutter, Stack Fall, Brickline, Orbit, Bubble, Pong Zen, Fruit Slice.
3. **3D action:** Ridge Run, Rail Dash, Puck, Hop, Pocket Golf, Labyrinth, Drift, Helix Drop.
4. **Board games against AI:** Gambit, Reversi, Connect Four. They share one minimax/negamax search module.
5. **Puzzles:** Turnstile, Twenty48, Minefield, Nine, Sokoban, Pipe Flow, Lights Out, Nonogram.
6. **Cards and tiles:** Solitaire, Pairs, Mahjong Solitaire, Word Hunt (bundled offline dictionary, kept under about 1 MB and lazy-loaded).
7. **Polish and quality:** each game is lazy-loaded through dynamic `import()`, so the home screen stays fast with 32 games. performance pass (60 fps on a mid-range phone, battery mode), accessibility, Lighthouse PWA audit, README + PROGRESS.

## v2 backlog (not built now)
Accounts and a database for synced saves, global leaderboards, daily seeded challenges and shareable result cards, real-time multiplayer (chess, air hockey, Pong), ghost-race sharing, a level editor for Turnstile and Sokoban, and an optional Capacitor wrapper for native haptics.

## Verification
- `npm run test` (Vitest) runs unit tests for every `logic.ts`: chess perft node counts, Stack Fall SRS rotations and kicks, Sudoku solution uniqueness, Minesweeper's safe first click, maze connectivity, the 2048 reducer, snapshot round-trips (serialize → restore → same state).
- `npm run build` (static export to `out/`), serve it with `npx serve out`, then run a Playwright smoke script: every game launches full screen, accepts input, pauses on `visibilitychange`, and resumes from its snapshot after a reload. Checked at 360, 768 and 1440 px, with no console errors.
- A manual check on a real phone while on a call, for one-thumb play, haptics and resume.
- Nothing is called done until its logic tests and smoke test pass. Any failures are reported as they are.
