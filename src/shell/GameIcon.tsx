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
};

export function GameIcon({ game }: { game: GameMeta }) {
  return GLYPHS[game.id] ?? <span className="monogram">{game.name.slice(0, 2)}</span>;
}
