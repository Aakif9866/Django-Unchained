# On Hold

**Games for the in-between.** A pocket arcade for when you're on a phone call: one thumb, silent by default, and it
pauses the instant you look away. Come back later, even after closing the browser, and you're at the exact same moment.

- 32 original single-player games are planned (arcade, 3D action, puzzles, board games against AI, cards). **2 are
  playable now:** Coil (snake) and Glide (3D tower stacking).
- No account and no server. Scores, settings and saved runs stay on your device (localStorage + IndexedDB).
- Installable as an app and built to work offline.

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

`npm run build` writes a fully static site to `out/`. On Vercel, import the repo; no settings are needed. Any static
host that serves `out/` works too.

## How it's built

Next.js 16 (static export), TypeScript, Tailwind CSS v4, Motion for spring animation, Three.js for the 3D games, and
zustand + idb-keyval for local data. Each game has pure rules (`logic.ts`, unit tested) separate from rendering
(`index.ts`), and all games plug into one shared engine: fixed-timestep loop, unified touch/keyboard input, snapshots.
See `CLAUDE.md` for the architecture and `docs/plan.md` for the full roadmap.
