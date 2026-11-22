"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { savedGameIds } from "@/engine/snapshot";
import { useStore } from "@/engine/store";
import { CATEGORIES, GAMES, getGame, gradientCss, isPlayable, type Category, type GameMeta } from "@/games/registry";
import { GameIcon } from "./GameIcon";
import { useHydrated } from "./Providers";
import { SettingsSheet } from "./SettingsSheet";

const PRESS = { scale: 0.985 };
const PRESS_SPRING = { type: "spring", bounce: 0, visualDuration: 0.15 } as const;

function Card({ game, best, i }: { game: GameMeta; best?: number; i: number }) {
  const ready = isPlayable(game);
  if (!ready)
    return (
      <div className="card soon" data-ready="false" aria-disabled="true" aria-label={`${game.name}, coming soon`} style={{ ["--tick" as string]: gradientCss(game, 90) }}>
        <span className="soon-icon" style={{ backgroundImage: gradientCss(game) }}>
          <GameIcon game={game} />
        </span>
        <span className="min-w-0">
          <span className="t-headline block truncate text-[0.9375rem]">{game.name}</span>
          <span className="t-caption block truncate">{game.render === "3d" ? "3D · " : ""}{game.category}</span>
        </span>
      </div>
    );
  return (
    <motion.div whileTap={PRESS} transition={PRESS_SPRING} className="fade-up h-full" style={{ ["--d" as string]: `${Math.min(i, 12) * 35}ms` }}>
      <Link
        href={`/play/${game.id}`}
        className="card h-full"
        data-ready="true"
        aria-label={`Play ${game.name}`}
        style={{ ["--tick" as string]: gradientCss(game, 90) }}
        // Start fetching the game's code on hover / press, so it's usually there before the page opens.
        onPointerEnter={() => void game.load?.()}
        onPointerDown={() => void game.load?.()}
        onFocus={() => void game.load?.()}
      >
        <div className="card-art">
          {game.render === "3d" && <span className="badge" style={{ right: 10 }}>3D</span>}
          <span className="tile" style={{ backgroundImage: gradientCss(game) }}>
            <GameIcon game={game} />
          </span>
        </div>
        <div className="card-body">
          <span className="t-headline">{game.name}</span>
          <span className="t-caption line-clamp-2">{game.tagline}</span>
          {best ? <span className="mt-auto pt-1 font-mono text-[0.72rem] uppercase tracking-[.12em]" style={{ color: "var(--muted)" }}>Best {best}</span> : null}
        </div>
      </Link>
    </motion.div>
  );
}

function Continue({ game, resumable }: { game: GameMeta; resumable: boolean }) {
  return (
    <motion.div whileTap={{ scale: 0.99 }} transition={PRESS_SPRING} className="fade-up" style={{ ["--d" as string]: "160ms" }}>
      <Link
        href={`/play/${game.id}`}
        className="surface relative flex items-center gap-4 overflow-hidden rounded-[var(--radius-lg)] p-4 md:gap-6 md:p-6"
        aria-label={`${resumable ? "Resume" : "Play"} ${game.name}`}
      >
        <span
          className="tile shrink-0"
          style={{ backgroundImage: gradientCss(game), width: "clamp(64px, 18vw, 96px)", maxWidth: "none" }}
        >
          <GameIcon game={game} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="t-eyebrow text-[0.72rem]">{resumable ? "Pick up where you left off" : "Jump in"}</div>
          <div className="t-title mt-1 truncate">{game.name}</div>
          <div className="t-body truncate">{game.tagline}</div>
        </div>
        <span className="btn btn-cta hidden shrink-0 sm:inline-flex">
          {resumable ? "Resume" : "Play"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="btn btn-cta shrink-0 px-4 sm:hidden" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </Link>
    </motion.div>
  );
}

export function Home() {
  const hydrated = useHydrated();
  const bests = useStore((s) => s.bests);
  const recent = useStore((s) => s.recent);
  const [saved, setSaved] = useState<string[]>([]);
  const [filter, setFilter] = useState<Category | "All">("All");
  const [settings, setSettings] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    savedGameIds().then(setSaved);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const playable = GAMES.filter(isPlayable);
  const shelf = useMemo(
    () => [...new Set([...saved, ...(hydrated ? recent : [])])].map(getGame).filter((g): g is GameMeta => !!g && isPlayable(g)),
    [saved, recent, hydrated],
  );
  const hero = shelf[0] ?? getGame("glide")!;
  const list = filter === "All" ? GAMES : GAMES.filter((g) => g.category === filter);
  const ready = list.filter(isPlayable);
  const soon = list.filter((g) => !isPlayable(g));
  const played = hydrated ? Object.keys(bests).length : 0;

  return (
    <div className="relative min-h-dvh">
      <div className="hero-bg" aria-hidden>
        <div className="aurora" />
      </div>

      {/* Glass header: clear at the top, frosted once you scroll. */}
      <header
        className={`fixed inset-x-0 top-0 z-20 transition-[background-color,border-color] duration-300 ${scrolled ? "glass border-b border-[var(--line)]" : "border-b border-transparent"}`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-[var(--gutter)]">
          <Link href="/" className="flex items-center gap-2.5" aria-label="On Hold home">
            <span className="brand-mark">OH</span>
            <span className="text-[0.95rem] font-semibold tracking-[-0.02em]">On Hold</span>
          </Link>
          <div className="flex items-center gap-2">
            <button className="icon-btn surface" onClick={() => setSettings(true)} aria-label="Settings">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" />
                <circle cx="16" cy="7" r="2.2" />
                <circle cx="10" cy="17" r="2.2" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-[1] mx-auto max-w-6xl px-[var(--gutter)] pb-16 pt-[calc(env(safe-area-inset-top)+56px)]">
        <section className="pb-8 pt-10 md:pb-12 md:pt-20">
          <h1 className="t-display fade-up" style={{ ["--d" as string]: "40ms" }}>
            Games for the <span className="grad-text grad-shimmer">in-between.</span>
          </h1>
          <p className="t-lede fade-up mt-4 max-w-2xl" style={{ ["--d" as string]: "100ms" }}>
            Thirty-two one-thumb games for while you&apos;re on hold. Silent by default, and the instant you look away
            it pauses, so you come back to the exact same moment.
          </p>
        </section>

        <Continue game={hero} resumable={saved.includes(hero.id)} />

        <div className="stats fade-up mt-4" style={{ ["--d" as string]: "220ms" }}>
          <div><div className="v">{GAMES.length}</div><div className="l">Games</div></div>
          <div><div className="v">{played}</div><div className="l">You&apos;ve played</div></div>
          <div><div className="v">0</div><div className="l">Sign-ups</div></div>
          <div><div className="v">Offline</div><div className="l">After one visit</div></div>
        </div>

        {shelf.length > 1 && (
          <section className="mt-14" aria-labelledby="recent-h">
            <h2 id="recent-h" className="t-eyebrow mb-4">01 — Recently played</h2>
            <div className="-mx-[var(--gutter)] flex gap-2.5 overflow-x-auto px-[var(--gutter)] pb-2 [scrollbar-width:none]">
              {shelf.map((g) => (
                <Link
                  key={g.id}
                  href={`/play/${g.id}`}
                  className="surface flex shrink-0 items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 transition-transform active:scale-[.97]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full [&_svg]:h-5 [&_svg]:w-5 [&_.monogram]:text-sm" style={{ backgroundImage: gradientCss(g) }}>
                    <GameIcon game={g} />
                  </span>
                  <span className="t-headline text-[0.9375rem]">{g.name}</span>
                  {saved.includes(g.id) && <span className="t-caption">· saved</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-14 border-t border-[var(--line)] pt-10" aria-labelledby="library-h">
          <div className="t-eyebrow mb-3">{shelf.length > 1 ? "02" : "01"} — The arcade</div>
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 id="library-h" className="t-h2">Library</h2>
            <span className="t-caption font-mono">{playable.length === GAMES.length ? `${GAMES.length} games` : `${playable.length} of ${GAMES.length} playable`}</span>
          </div>
          <div className="-mx-[var(--gutter)] mb-6 flex gap-2 overflow-x-auto px-[var(--gutter)] pb-1 [scrollbar-width:none]" role="toolbar" aria-label="Filter by category">
            {(["All", ...CATEGORIES] as const).map((c) => (
              <button key={c} className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
          {ready.length > 0 && (
            <div className="game-grid">
              {ready.map((g, i) => (
                <Card key={g.id} game={g} i={i} best={hydrated ? bests[g.id] : undefined} />
              ))}
            </div>
          )}
          {soon.length > 0 && (
            <>
              <h3 className="t-eyebrow mb-3 mt-10">On the way · {soon.length}</h3>
              <div className="soon-grid">
                {soon.map((g, i) => (
                  <Card key={g.id} game={g} i={i} />
                ))}
              </div>
            </>
          )}
        </section>

        <footer className="mt-16 flex flex-col items-center gap-2 border-t border-[var(--line)] pt-8 text-center">
          <span className="brand-mark">OH</span>
          <span className="t-caption">Everything stays on this device. No account, no tracking.</span>
        </footer>
      </div>

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
