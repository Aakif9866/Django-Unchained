import type { GameMeta } from "@/games/registry";

/** Hand-drawn glyphs for playable games; the rest show a monogram until they ship. */
const GLYPHS: Record<string, React.ReactNode> = {
  coil: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M10 34c0-6 5-8 10-8h8c5 0 10-2 10-8s-5-8-10-8h-6" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <circle cx="21" cy="10" r="5" fill="#fff" />
      <circle cx="38" cy="38" r="3.5" fill="#fff" opacity=".85" />
    </svg>
  ),
  glide: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M24 30 8 22l16-8 16 8-16 8Z" fill="#fff" opacity=".55" />
      <path d="M24 36 8 28v-6l16 8 16-8v6l-16 8Z" fill="#fff" opacity=".8" />
      <path d="M24 22 12 16l12-6 12 6-12 6Z" fill="#fff" />
      <path d="M24 26 12 20v-4l12 6 12-6v4l-12 6Z" fill="#fff" opacity=".9" />
    </svg>
  ),
  flutter: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="6" y="4" width="8" height="14" rx="3" fill="#fff" opacity=".55" />
      <rect x="6" y="32" width="8" height="12" rx="3" fill="#fff" opacity=".55" />
      <circle cx="30" cy="24" r="10" fill="#fff" />
      <path d="M22 26c4-1 7 1 8 5-5 1-8-1-8-5Z" fill="#fff" opacity=".6" />
      <circle cx="34" cy="21" r="1.8" fill="#0b3b3f" />
      <path d="M40 23l5 2-5 2Z" fill="#fff" opacity=".9" />
    </svg>
  ),
  "stack-fall": (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="17" y="4" width="9" height="9" rx="2.5" fill="#fff" />
      <rect x="17" y="13" width="9" height="9" rx="2.5" fill="#fff" />
      <rect x="26" y="13" width="9" height="9" rx="2.5" fill="#fff" />
      <rect x="6" y="35" width="9" height="9" rx="2.5" fill="#fff" opacity=".6" />
      <rect x="15" y="35" width="9" height="9" rx="2.5" fill="#fff" opacity=".6" />
      <rect x="33" y="35" width="9" height="9" rx="2.5" fill="#fff" opacity=".6" />
      <rect x="33" y="26" width="9" height="9" rx="2.5" fill="#fff" opacity=".6" />
    </svg>
  ),
  brickline: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="5" y="6" width="11" height="6" rx="2" fill="#fff" opacity=".6" />
      <rect x="18.5" y="6" width="11" height="6" rx="2" fill="#fff" />
      <rect x="32" y="6" width="11" height="6" rx="2" fill="#fff" opacity=".6" />
      <rect x="12" y="14" width="11" height="6" rx="2" fill="#fff" opacity=".85" />
      <circle cx="28" cy="29" r="3.5" fill="#fff" />
      <rect x="14" y="38" width="20" height="5" rx="2.5" fill="#fff" />
    </svg>
  ),
  orbit: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="17" stroke="#fff" strokeWidth="2" opacity=".35" strokeDasharray="4 5" />
      <path d="M33 13 38 9M14 37l-3 3" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <path d="M30 18 14 24l6 2 2 6 8-14Z" fill="#fff" />
      <path d="M9 10l4 1-2 3-3-1Z" fill="#fff" opacity=".7" />
    </svg>
  ),
  bubble: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="12" cy="10" r="6" fill="#fff" opacity=".6" />
      <circle cx="24" cy="10" r="6" fill="#fff" />
      <circle cx="36" cy="10" r="6" fill="#fff" opacity=".6" />
      <circle cx="18" cy="20.5" r="6" fill="#fff" />
      <circle cx="30" cy="20.5" r="6" fill="#fff" opacity=".8" />
      <path d="M24 42V32" stroke="#fff" strokeWidth="2" strokeDasharray="2 3" opacity=".7" />
      <circle cx="24" cy="40" r="5" fill="#fff" />
    </svg>
  ),
  rally: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="14" y="6" width="20" height="4" rx="2" fill="#fff" opacity=".6" />
      <rect x="14" y="38" width="20" height="4" rx="2" fill="#fff" />
      <path d="M6 24h36" stroke="#fff" strokeWidth="2" strokeDasharray="3 4" opacity=".4" />
      <circle cx="29" cy="19" r="4" fill="#fff" />
      <path d="M22 31l5-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".5" />
    </svg>
  ),
  "fruit-slice": (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M12 30a12 12 0 0 0 20 6Z" fill="#fff" opacity=".65" />
      <path d="M22 18a12 12 0 0 1 18 13Z" fill="#fff" />
      <path d="M6 40 42 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
      <circle cx="36" cy="38" r="2" fill="#fff" opacity=".7" />
      <circle cx="12" cy="14" r="1.6" fill="#fff" opacity=".7" />
    </svg>
  ),
  "rail-dash": (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M8 42 20 8M40 42 28 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
      <path d="M12 32h24M15 22h18M18 13h12" stroke="#fff" strokeWidth="2" opacity=".35" />
      <rect x="25" y="14" width="9" height="16" rx="2" fill="#fff" opacity=".8" />
      <circle cx="18" cy="34" r="4" fill="#fff" />
    </svg>
  ),
  "ridge-run": (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M2 36 14 20l8 9 9-15 15 22Z" fill="#fff" opacity=".45" />
      <path d="M16 46c4-10 10-16 18-20" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <circle cx="35" cy="12" r="5" fill="#fff" />
    </svg>
  ),
  puck: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="8" y="4" width="32" height="40" rx="6" stroke="#fff" strokeWidth="2" opacity=".5" />
      <path d="M8 24h32" stroke="#fff" strokeWidth="2" opacity=".4" />
      <circle cx="24" cy="34" r="6" fill="#fff" />
      <circle cx="24" cy="34" r="2.5" fill="#fff" opacity=".5" />
      <circle cx="20" cy="16" r="3.5" fill="#fff" opacity=".85" />
    </svg>
  ),
  hop: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="4" y="30" width="40" height="10" rx="2" fill="#fff" opacity=".35" />
      <path d="M8 35h6M20 35h6M32 35h6" stroke="#fff" strokeWidth="2" opacity=".6" />
      <rect x="18" y="12" width="12" height="12" rx="3" fill="#fff" />
      <rect x="21" y="8" width="5" height="5" rx="1" fill="#fff" opacity=".8" />
      <path d="M24 26v2" stroke="#fff" strokeWidth="2" />
    </svg>
  ),
  "pocket-golf": (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M8 40c6-6 26-6 32 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
      <ellipse cx="30" cy="38" rx="4" ry="1.6" fill="#fff" opacity=".7" />
      <path d="M30 38V8" stroke="#fff" strokeWidth="2" />
      <path d="M30 8l12 5-12 5Z" fill="#fff" />
      <circle cx="14" cy="34" r="3.5" fill="#fff" />
    </svg>
  ),
  labyrinth: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M6 6h36v36H6Z" stroke="#fff" strokeWidth="2.5" opacity=".6" />
      <path d="M6 18h22M20 18v12M14 30h22M34 30V6M28 42V36" stroke="#fff" strokeWidth="2.5" opacity=".85" />
      <circle cx="12" cy="12" r="3.5" fill="#fff" />
      <circle cx="38" cy="38" r="2.5" stroke="#fff" strokeWidth="1.5" />
    </svg>
  ),
  drift: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M10 40c-6-10 2-20 14-18s18-8 14-16" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".35" />
      <path d="M10 40c-6-10 2-20 14-18s18-8 14-16" stroke="#fff" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" />
      <rect x="28" y="4" width="12" height="7" rx="2" fill="#fff" transform="rotate(-30 34 7)" />
    </svg>
  ),
  "helix-drop": (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="21" y="2" width="6" height="44" rx="3" fill="#fff" opacity=".5" />
      <path d="M6 14h14M28 14h14M6 26h22M34 26h8M6 38h8M20 38h22" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="31" cy="20" r="3.5" fill="#fff" />
    </svg>
  ),
};

export function GameIcon({ game }: { game: GameMeta }) {
  return GLYPHS[game.id] ?? <span className="monogram">{game.name.slice(0, 2)}</span>;
}
