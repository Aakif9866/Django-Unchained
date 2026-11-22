# On Hold: how the games work

32 single-player games you can play with one thumb while on a call. This page covers how each game is played, what
runs underneath, and which parts are shared.

## Was any API used?

**No external web API, no backend, no database.** Every game runs fully in the browser, and the whole site is a
static export (`next build` with `output: "export"`) served from Vercel's CDN. Nothing is sent anywhere. Scores,
settings and saved runs stay on the device.

The only APIs are ones built into the browser:

| Browser API | Used for |
|---|---|
| Canvas 2D | Drawing every 2D game, the Jigsaw hero art and the cut puzzle pieces |
| WebGL (through Three.js) | The 3D games (Glide, Ridge Run, Rail Dash, Puck, Turnstile, Labyrinth, Hop, Pocket Golf, Drift, Helix Drop) |
| Pointer Events, Keyboard, Gamepad | One input system: tap, swipe, drag with velocity, keys, controller |
| Web Workers | Reversi and Four Up think in a worker, so the screen never freezes |
| IndexedDB (via `idb-keyval`) | Saving the exact running game on pause, blur, tab hide and every 4 s |
| localStorage (via zustand `persist`) | Settings, best scores, run history, difficulty picks, colour theme |
| Vibration, Web Audio | Haptics (on by default) and synthesised sounds (off by default, since you're on a call) |
| Battery Status | Automatic battery saver below 20% (30 fps, lower resolution) |
| DeviceOrientation | Tilt-to-roll in Labyrinth |
| Service Worker, Cache Storage | Offline play: the whole site is precached after the first visit |
| Fullscreen | The full-screen button on desktop |

Word Hunt's dictionary is a local file (`public/words.txt`, built from Webster's 2nd edition, which is public domain).
It's not a web service.

**Jigsaw's thousands of superheroes aren't downloaded from anywhere.** They're drawn in code (`src/games/jigsaw/hero.ts`)
at 1920 × 1080 from a seed number from 1 to 9999. The seed decides the sky, city, pose, build, costume colours, cape,
mask or helmet, chest emblem and a generated name ("Thunder Viper"). Every hero is original, so there's no
copyright problem, and they work offline.

## The shared engine (written once, reused by all 32 games)

| Piece | File | What it does |
|---|---|---|
| Game contract | `src/engine/types.ts` | Every game is `create(env)`, which returns `update(dt)`, `render(alpha)`, `serialize()`, `restore()` and `destroy()`. It's the only abstraction. |
| Fixed-step loop | `src/engine/loop.ts` | Rules always step at 1/60 s, whatever the screen's refresh rate. Rendering interpolates between steps, so motion is smooth at 30, 60 or 120 Hz. |
| Unified input | `src/engine/input.ts` | Turns touches, mouse, keys and gamepad into `tap`, `swipe`, `drag` (with velocity) and `action` events. A two-finger touch pauses. |
| Stages | `src/engine/stage.ts` | A 2D canvas sized for the screen's pixel density, or a Three.js scene with a shared lighting rig. |
| Seeded random | `src/engine/rng.ts` | mulberry32. Its state is one number, so it's saved with the game. A restored run continues with exactly the same randomness. |
| Snapshots | `src/engine/snapshot.ts` | Saves `{ game state, rng state, score, difficulty }` to IndexedDB. |
| Store | `src/engine/store.ts` | Settings, bests, last 20 runs per game, recently played, difficulty per game. |
| Feedback | `src/engine/feedback.ts` | `feel("tap" / "score" / "success" / "fail")` produces a vibration and an optional synthesised tone. |
| Call mode | `src/shell/GameFrame.tsx` | Pauses and saves instantly on window blur, tab hide, Esc, P or a two-finger tap. After a reload it says "Welcome back" and resumes the exact frame. |

**Rules vs. drawing.** Each game has a `logic.ts`: pure rules over plain JSON objects, with no DOM, no clock and only
the injected random generator. Each also has an `index.ts` that draws that state and turns input into rule calls.
Because the state is plain JSON, "save" is `JSON.stringify` and "resume" just rebuilds the picture from the state.
Every `logic.ts` has a Vitest file, and every test suite includes a snapshot round-trip.

**Shared between groups of games:**
- `src/games/kit.ts`: the Web Worker "thinker" bridge for the board-game engines, and the drawn pill, thinking dots
  and result banner used by most 2D games.
- `src/games/runner-core.ts` + `runner-view.ts`: Ridge Run and Rail Dash share one lane-runner engine (three lanes;
  jump, roll, change lane; always one reachable safe lane) and one 3D view.
- `src/games/search.ts`: negamax with alpha-beta pruning, iterative deepening and root "noise" (so the low levels play
  like people). Shared by Reversi and Four Up.

## Easy / Medium / Hard

Most games ask for a difficulty on the start sheet and again on the game-over card. The choice is remembered per game.
A saved run keeps the difficulty it was started on.

- **Speed:** in the 15 real-time games, the game frame runs the rules at **0.8× (Easy), 1× (Medium) or 1.3× (Hard)**
  speed (`SPEED` in `registry.ts`). That's one line that makes every fast game faster.
- **Rules:** many games also change one rule (listed per game below). The value lives in the game's state, so restore
  keeps it.
- **No difficulty:** Crates, Turnstile, Pipe Flow, Lights Out and Pocket Golf. They already go level by level, with
  hand-checked or proven-par levels.

## The games

### Arcade

**Coil** (snake): swipe to steer and eat to grow, without hitting a wall or yourself. *Logic:* turns are buffered, so a
quick double swipe works. You may move into the cell your tail is leaving. Speed ramps as you grow. *Levels:* speed.

**Flutter** (one-tap flyer): tap to flap through gaps in the pillars. *Logic:* gravity plus a flap impulse. Gaps never
jump more than 30 units between pillars, and a test autopilot proves runs are beatable. Speed and gap size ramp, then
cap. *Levels:* speed, and gaps 6 units bigger on Easy and 3 smaller on Hard.

**Stack Fall** (falling blocks): move, rotate and drop pieces to clear full lines. *Logic:* the real Super Rotation
System with wall kicks, a 7-bag randomiser, hold, ghost, lock delay with move-reset, and guideline gravity and
scoring. *Levels:* start at level 1, 4 or 8 (faster gravity, more points per line).

**Brickline** (brick breaker): move the paddle, break every brick, catch the power-ups. *Logic:* the ball is sub-stepped
so it never moves more than half its radius per step, so collisions never tunnel through a brick. *Levels:* speed,
and the paddle is 4 units wider on Easy and 4 narrower on Hard.

**Orbit** (asteroids): drag to aim and thrust; the ship fires on its own. Rocks split as you hit them. *Logic:* a
wraparound world and a one-thumb twin-stick (the drag vector is both aim and thrust). *Levels:* speed.

**Bubble** (bubble shooter): aim, bank off walls, and pop groups of three or more; floating clusters drop. *Logic:* an
offset hex grid, a flood fill for matches, and a reachability pass from the ceiling for the drops. *Levels:* speed.

**Rally** (paddle duel): first to 7 against the AI. *Logic:* the AI only re-reads the ball every few hundredths of a
second and aims with an error, so it's human-like and beatable. Each match won makes it sharper. *Levels:* speed, and
the AI starts a level softer on Easy and 1.5 levels sharper on Hard.

**Fruit Slice**: swipe through fruit and avoid bombs; missing fruit costs a life. *Logic:* arcs are thrown so they peak
on screen, swipe segments are tested against circles, and several fruits in one swipe score a combo. *Levels:* speed,
and bombs at 0.6× / 1× / 1.4× the rate.

### Action (mostly 3D)

**Glide** (stack tower): tap to drop the sliding block. Whatever overhangs is sliced off. *Logic:* overlap on one axis
per floor; a near-perfect drop snaps and, after a streak, grows the block back. *Levels:* speed.

**Ridge Run** and **Rail Dash** (lane runners): swipe to change lane, jump and roll. *Logic:* the shared
`runner-core` always keeps one reachable safe lane. *Levels:* speed.

**Puck** (air hockey): drag your mallet and score 7 before the AI. *Logic:* circle physics with restitution, friction
and sub-steps; mallets carry their own velocity into hits. *Levels:* speed, plus the same softer or sharper AI as Rally.

**Hop** (road crosser): hop forward across roads, rivers (ride the logs) and rails (a warned, fast train). *Logic:*
rows generated ahead, and a camera that creeps forward so you can't dawdle. *Levels:* speed.

**Labyrinth**: tilt the maze (drag, or tilt the phone) to roll the ball home, avoiding holes. *Logic:* a perfect maze
carved depth-first, circle-vs-segment walls, holes in dead ends. *Levels:* speed.

**Drift**: three-lap time attack against your own ghost. *Logic:* a spline track and arcade car physics with real
slip (grip drops when you steer hard at speed). Your best lap is saved as a ghost. *Levels:* speed.

**Helix Drop**: spin the tower so the bouncing ball falls through the gaps. *Logic:* rings of 12 slices (gap / safe /
danger). Falling through 3 or more rings in a row smashes the next danger slice. *Levels:* speed.

**Pocket Golf** (no difficulty): nine handmade holes; drag back and let go to putt. *Logic:* friction, slopes, sand,
water penalties, and circle-vs-segment walls.

### Puzzle

**Jigsaw** (new): drag pieces onto the board; close enough and they snap and lock. Space places one piece for free.
*Logic:* the picture is cut into a grid. Every inside edge gets a seeded tab or blank (stored once per edge, so two
neighbours always fit). Pieces are cut once with a bezier jigsaw outline and cached, and a drop within 0.3 of a cell
of its home snaps. Score: 10 per piece plus 2 per second under par (8 s per piece). *Levels:* 12, 24 or 48 pieces,
and a faint picture guide on Easy, a grid on Medium, nothing on Hard.

**Twenty48**: swipe to slide every tile; equal tiles merge. *Logic:* each tile merges at most once per move. Undo also
rewinds the random generator, so you can't fish for a better spawn. *Levels:* new tiles are a 4 5% / 10% / 25% of the
time, and there's no undo on Hard.

**Minefield** (minesweeper): dig and flag; numbers count neighbouring mines. *Logic:* mines are laid on your first dig,
never on or next to it, so every board opens with a free area. Boards grow and get denser. *Levels:* 0.75× / 1× /
1.3× the mines.

**Nine** (sudoku): fill the grid so every row, column and box has 1–9; three mistakes end the run. *Logic:* fill a
random full grid, then remove clues one by one, keeping a removal only if the puzzle still has exactly one solution.
Puzzles are graded "Gentle" when singles alone solve them. *Levels:* about 6 more clues on Easy and 6 fewer on Hard.

**Nonogram**: paint cells to match the row and column numbers. *Logic:* a puzzle is kept only if a line solver can
finish it from the clues alone, which proves it's unique and needs no guessing. *Levels:* 5 / 3 / 1 mistakes allowed.

**Word Hunt**: drag through neighbouring letters to spell words; reach the target before time runs out. *Logic:* a
solver keeps only grids with 25 or more words, and scoring goes by length. *Levels:* 150 / 120 / 90 seconds per
round.

**Pipe Flow** (no difficulty): turn tiles until water reaches every pipe with no leaks. *Logic:* a random spanning tree
grown from the source guarantees a solution; par is the fewest taps back.

**Lights Out** (no difficulty): every tap flips a light and its neighbours; turn them all off. *Logic:* puzzles are
made by pressing a dark board, so each is solvable. Par is the true minimum, found by Gaussian elimination over GF(2).

**Crates** (no difficulty): push every crate onto a mark. *Logic:* original hand-drawn levels, each proven solvable by
a breadth-first solver in the tests.

**Turnstile** (no difficulty): tap a turnstile and every turnstile of its colour turns, like linked gears; open a path
home for the bot. *Logic:* original levels with a proven par.

### Board

**Reversi**: place a disc to outflank and flip your opponent's. *Logic:* shared negamax search, with an exact endgame
solve at the higher levels, running in a Web Worker. Win and the next engine is stronger. *Levels:* you start
against engine level 1, 2 or 3.

**Four Up** (connect four): drop discs and line up four. *Logic:* the same search and worker, up to depth 16 at Master.
*Levels:* you start against engine level 1, 2 or 3.

### Cards

**Solitaire** (Klondike, draw one): build the foundations from ace to king. *Logic:* a depth-first solver must win each
deal (within a node budget) before you see it, so every deal is winnable. *Levels:* unlimited / 3 / 2 passes
through the stock (Hard deals are proven with the 2-pass rule).

**Pairs** (memory): flip two cards to find a pair before the clock runs out. *Logic:* a seeded shuffle; boards grow
from 6 to 12 pairs; a streak scores more. *Levels:* 1.3× / 1× / 0.75× the time.

**Tiles** (tile-matching solitaire): match two free tiles with the same face. *Logic:* solvable by construction,
because faces are dealt in pairs along a legal removal order. *Levels:* 3 / 2 / 1 shuffles.

## Removed

**Gambit** (chess) was removed in session 11 because it wasn't good enough. Jigsaw took its slot, so there are still
32 games.
