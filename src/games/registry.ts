/** Single list of games. Metadata is tiny; game code is only fetched when a game opens. */
import type { GameModule } from "@/engine/types";

export type Category = "Arcade" | "Action" | "Puzzle" | "Board" | "Cards";

export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  category: Category;
  render: "2d" | "3d";
  gradient: [string, string, string];
  controls: string;
  /** Snapshot format version. Bump it when serialize() changes shape. */
  version: number;
  load?: () => Promise<{ default: GameModule }>;
}

const g = (
  id: string,
  name: string,
  tagline: string,
  category: Category,
  render: "2d" | "3d",
  gradient: [string, string, string],
  controls = "",
  load?: GameMeta["load"],
): GameMeta => ({ id, name, tagline, category, render, gradient, controls, version: 1, load });

export const GAMES: GameMeta[] = [
  g("coil", "Coil", "The classic snake, tuned smooth.", "Arcade", "2d", ["#34e89e", "#0fb8ad", "#1f6feb"],
    "Swipe anywhere to steer · Arrow keys / WASD", () => import("./coil")),
  g("glide", "Glide", "Stack the tower. Nail the perfect drop.", "Action", "3d", ["#ff6a88", "#ff99ac", "#fcb69f"],
    "Tap anywhere to drop · Space", () => import("./glide")),
  g("ridge-run", "Ridge Run", "A gentle endless run along the cliffs.", "Action", "3d", ["#f7971e", "#ffd200", "#ff6a00"],
    "Swipe ← → to change lane, ↑ to jump, ↓ to duck · Arrow keys", () => import("./ridge-run")),
  g("rail-dash", "Rail Dash", "Three lanes. Jump, roll, dash.", "Action", "3d", ["#00c6ff", "#0072ff", "#7f00ff"],
    "Swipe ← → to switch lanes, ↑ to jump, ↓ to roll · Arrow keys", () => import("./rail-dash")),
  g("flutter", "Flutter", "One tap to fly through the gaps.", "Arcade", "2d", ["#a8ff78", "#78ffd6", "#38bdf8"],
    "Tap anywhere to flap · Space / ↑", () => import("./flutter")),
  g("puck", "Puck", "Air hockey against a sharp AI.", "Action", "3d", ["#e0eafc", "#7f7fd5", "#86a8e7"],
    "Drag your mallet anywhere on your half · Arrow keys", () => import("./puck")),
  g("turnstile", "Turnstile", "Rotate the world, guide the bot home.", "Puzzle", "3d", ["#c471f5", "#fa71cd", "#f7797d"]),
  g("gambit", "Gambit", "Chess against an engine that thinks.", "Board", "2d", ["#bdc3c7", "#8e9eab", "#2c3e50"]),
  g("stack-fall", "Stack Fall", "Falling blocks, clean lines.", "Arcade", "2d", ["#fc466b", "#3f5efb", "#00d2ff"],
    "Drag to move · Tap to rotate · Flick down to drop, up to hold · ← → ↑ ↓ Space C", () => import("./stack-fall")),
  g("brickline", "Brickline", "Break every brick, catch the power-ups.", "Arcade", "2d", ["#f12711", "#f5af19", "#ffe259"],
    "Drag to move · Tap to launch · ← → Space", () => import("./brickline")),
  g("twenty48", "Twenty48", "Slide, merge, reach 2048.", "Puzzle", "2d", ["#ffb347", "#ffcc33", "#ff7e5f"]),
  g("minefield", "Minefield", "Flags, numbers and nerve.", "Puzzle", "2d", ["#56ab2f", "#a8e063", "#2c7744"]),
  g("nine", "Nine", "Sudoku with one true answer.", "Puzzle", "2d", ["#4facfe", "#00f2fe", "#43e97b"]),
  g("labyrinth", "Labyrinth", "Tilt the maze, roll the ball home.", "Action", "3d", ["#b79891", "#94716b", "#f6d365"],
    "Drag to tilt the maze (or tilt your phone) · Arrow keys", () => import("./labyrinth")),
  g("orbit", "Orbit", "Drift, rotate, shatter the rocks.", "Arcade", "2d", ["#8360c3", "#2ebf91", "#0f0c29"],
    "Drag to steer & thrust · Fires on its own · ← → ↑", () => import("./orbit")),
  g("hop", "Hop", "Cross the road. Then the next one.", "Action", "3d", ["#11998e", "#38ef7d", "#d4fc79"],
    "Tap to hop forward · Swipe to hop any way · Arrow keys", () => import("./hop")),
  g("pocket-golf", "Pocket Golf", "Nine holes that fit in a coffee break.", "Action", "3d", ["#76b852", "#8dc26f", "#e2f0cb"],
    "Drag back from anywhere and let go to putt · ← → aim, ↑ ↓ power, Space", () => import("./pocket-golf")),
  g("solitaire", "Solitaire", "Klondike, with deals you can win.", "Cards", "2d", ["#134e5e", "#71b280", "#c9ffbf"]),
  g("pairs", "Pairs", "Flip, remember, match.", "Cards", "2d", ["#ee9ca7", "#ffdde1", "#c79081"]),
  g("bubble", "Bubble", "Aim, bank, pop the clusters.", "Arcade", "2d", ["#00dbde", "#fc00ff", "#ffd1ff"],
    "Drag to aim, release to shoot · Tap the shooter to swap · ← → Space C", () => import("./bubble")),
  g("rally", "Rally", "Paddle duel against a patient AI.", "Arcade", "2d", ["#e1eec3", "#f05053", "#6a3093"],
    "Drag to move your paddle · ← →", () => import("./rally")),
  g("reversi", "Reversi", "Outflank and flip the board.", "Board", "2d", ["#0f2027", "#2c5364", "#a8e063"]),
  g("four-up", "Four Up", "Drop discs, connect four.", "Board", "2d", ["#ff512f", "#dd2476", "#f9d423"]),
  g("word-hunt", "Word Hunt", "Trace words in a grid of letters.", "Puzzle", "2d", ["#f6d365", "#fda085", "#f093fb"]),
  g("pipe-flow", "Pipe Flow", "Turn the pipes, let it flow.", "Puzzle", "2d", ["#2193b0", "#6dd5ed", "#b2fefa"]),
  g("lights-out", "Lights Out", "Every tap flips its neighbours.", "Puzzle", "2d", ["#fceabb", "#f8b500", "#ff6e7f"]),
  g("crates", "Crates", "Push every crate onto its mark.", "Puzzle", "2d", ["#c79081", "#dfa579", "#8e5e3b"]),
  g("drift", "Drift", "Race your own ghost lap.", "Action", "3d", ["#ff0099", "#493240", "#ff6a00"],
    "Hold left / right side to steer, or drag · Drag down to brake · ← → ↓", () => import("./drift")),
  g("fruit-slice", "Fruit Slice", "Swipe fast, slice clean.", "Arcade", "2d", ["#f83600", "#f9d423", "#a8e063"],
    "Swipe to slice · Avoid the bombs", () => import("./fruit-slice")),
  g("helix-drop", "Helix Drop", "Fall through the spinning tower.", "Action", "3d", ["#fa709a", "#fee140", "#30cfd0"],
    "Drag sideways to spin the tower · ← →", () => import("./helix-drop")),
  g("nonogram", "Nonogram", "Paint the picture from the numbers.", "Puzzle", "2d", ["#667eea", "#764ba2", "#e0c3fc"]),
  g("tiles", "Tiles", "Match free tiles, clear the stack.", "Cards", "2d", ["#d4af37", "#f3e7c3", "#8a6e2f"]),
];

export const CATEGORIES: Category[] = ["Arcade", "Action", "Puzzle", "Board", "Cards"];

export const getGame = (id: string) => GAMES.find((x) => x.id === id);
export const isPlayable = (m: GameMeta) => Boolean(m.load);
export const gradientCss = (m: GameMeta, angle = 135) =>
  `linear-gradient(${angle}deg, ${m.gradient[0]}, ${m.gradient[1]} 55%, ${m.gradient[2]})`;
