# On Hold

**Games for the in-between.** A pocket arcade for when you're on a phone call: one thumb, silent by default, and it
pauses the instant you look away. Come back later, even after closing the browser, and you're at the exact same moment.

**Play it: [on-hold-theta.vercel.app](https://on-hold-theta.vercel.app)**

- **32 original single-player games.** Arcade (snake, falling blocks, brick breaker, bubble shooter…), 3D action
  (runners, air hockey, mini golf, a tilt maze, a racer), puzzles (superhero jigsaws, sudoku, nonograms, minesweeper,
  box pushing…), board games against an engine (Reversi, connect-four), and cards and tiles (solitaire, memory, tile matching,
  a word hunt).
- **Call mode.** It pauses on tab switch, blur, a two-finger tap or Esc, and saves a snapshot so it resumes exactly
  after a reload. Haptics are on, sound is off, and there's a battery saver.
- **No account and no server.** Scores, settings and saved runs stay on your device (localStorage + IndexedDB).
  It installs as an app and works offline after one visit.
- **Easy / Medium / Hard** for most games: faster and tougher as you go up. Level-based puzzles skip it.
- Six colour grades (Aurora, Apple Blue, Emerald, Solar, Ocean, Titanium) in Settings.

## Run it

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Test it

```bash
npm test           # game-rule unit tests (Vitest)
npm run build      # static export to out/
npm run e2e        # browser checks against out/ using your installed Chrome
```

## Deploy

`npm run build` writes a fully static site to `out/`, served on Vercel with `cleanUrls` (so `/play/coil` serves
`play/coil.html`). Any static host that serves `out/` works too. See `PROGRESS.md` → "Deployment" for the steps.

## How it's built

Next.js 16 (static export), TypeScript, Tailwind CSS v4, Motion for spring animation, Three.js for the 3D games, and
zustand + idb-keyval for local data. Each game has pure rules (`logic.ts`, unit tested) separate from rendering
(`index.ts`), and all games plug into one shared engine: a fixed-timestep loop, unified touch/keyboard/gamepad input,
and snapshots. The Reversi and connect-four engines share one search and run in Web Workers. How every game plays, its core logic, and the browser APIs used: [`docs/games.md`](docs/games.md). See `CLAUDE.md`
for the architecture and `docs/plan.md` for the roadmap.
