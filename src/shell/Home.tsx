"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { savedGameIds } from "@/engine/snapshot";
import { useStore } from "@/engine/store";
import { CATEGORIES, GAMES, getGame, gradientCss, isPlayable, type Category, type GameMeta } from "@/games/registry";
import { GameIcon } from "./GameIcon";
import { HoldClock } from "./HoldClock";
import { useHydrated } from "./Providers";
import { SettingsSheet } from "./SettingsSheet";

const PRESS = { scale: 0.97 };
const PRESS_SPRING = { type: "spring", bounce: 0, visualDuration: 0.15 } as const;

function Card({ game, best }: { game: GameMeta; best?: number }) {
  const ready = isPlayable(game);
  const inner = (
    <>
      <div className="card-art" style={{ backgroundImage: gradientCss(game) }}>
        {game.render === "3d" && <span className="badge" style={{ left: 10 }}>3D</span>}
        {!ready && <span className="badge" style={{ right: 10 }}>SOON</span>}
        <GameIcon game={game} />
      </div>
      <div className="card-body">
        <span className="t-headline">{game.name}</span>
        <span className="t-caption line-clamp-2">{game.tagline}</span>
        {ready && best ? <span className="t-caption mt-auto pt-1" style={{ color: "var(--text-2)" }}>Best {best}</span> : null}
      </div>
    </>
  );
  if (!ready)
    return (
      <div className="card" data-ready="false" aria-disabled="true" aria-label={`${game.name}, coming soon`}>
        {inner}
      </div>
    );
  return (
    <motion.div whileTap={PRESS} transition={PRESS_SPRING} className="h-full">
      <Link href={`/play/${game.id}`} className="card h-full" data-ready="true" aria-label={`Play ${game.name}`}>
        {inner}
      </Link>
    </motion.div>
  );
}

function Hero({ game, resumable }: { game: GameMeta; resumable: boolean }) {
  return (
    <motion.div whileTap={{ scale: 0.985 }} transition={PRESS_SPRING}>
      <Link
        href={`/play/${game.id}`}
        className="relative flex min-h-[208px] items-end overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] p-5 md:min-h-[260px] md:p-7"
        style={{ backgroundImage: gradientCss(game, 120) }}
      >
        <div className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 opacity-90 md:h-64 md:w-64 [&_svg]:h-full [&_svg]:w-full">
          <GameIcon game={game} />
        </div>
        <div className="material relative flex w-full items-center gap-4 rounded-[22px] p-4 md:max-w-md">
          <div className="min-w-0 flex-1">
            <div className="t-caption uppercase">{resumable ? "Pick up where you left off" : "Jump in"}</div>
            <div className="t-title truncate">{game.name}</div>
            <div className="t-body truncate">{game.tagline}</div>
          </div>
          <span className="btn btn-cta shrink-0">{resumable ? "Resume" : "Play"}</span>
        </div>
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

  useEffect(() => {
    savedGameIds().then(setSaved);
  }, []);

  const playable = GAMES.filter(isPlayable);
  const shelf = useMemo(
    () => [...new Set([...saved, ...(hydrated ? recent : [])])].map(getGame).filter((g): g is GameMeta => !!g && isPlayable(g)),
    [saved, recent, hydrated],
  );
  const hero = shelf[0] ?? getGame("glide")!;
  const list = filter === "All" ? GAMES : GAMES.filter((g) => g.category === filter);
  const sorted = [...list].sort((a, b) => Number(isPlayable(b)) - Number(isPlayable(a)));

  return (
    <div className="relative min-h-dvh">
      <div className="ambient" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <div className="relative z-[1] mx-auto max-w-6xl px-[var(--gutter)] pb-16 pt-[calc(env(safe-area-inset-top)+16px)]">
        <header className="flex items-center justify-between gap-3">
          <HoldClock />
          <button className="icon-btn material" onClick={() => setSettings(true)} aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" />
              <circle cx="16" cy="7" r="2.2" />
              <circle cx="10" cy="17" r="2.2" />
            </svg>
          </button>
        </header>

        <section className="pb-6 pt-10 md:pb-10 md:pt-16">
          <h1 className="t-display">
            <span className="brand-text">On Hold.</span>
            <br />
            Games for the in-between.
          </h1>
          <p className="t-body mt-3 max-w-xl">
            One thumb, no sign-up, silent by default. Leave mid-game and you&apos;ll come back to the exact same moment.
          </p>
        </section>

        <Hero game={hero} resumable={saved.includes(hero.id)} />

        {shelf.length > 1 && (
          <section className="mt-8" aria-labelledby="recent-h">
            <h2 id="recent-h" className="t-headline mb-3">Recently played</h2>
            <div className="-mx-[var(--gutter)] flex gap-3 overflow-x-auto px-[var(--gutter)] pb-2 [scrollbar-width:none]">
              {shelf.map((g) => (
                <Link
                  key={g.id}
                  href={`/play/${g.id}`}
                  className="surface flex shrink-0 items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 active:scale-[.97] transition-transform"
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

        <section className="mt-10" aria-labelledby="library-h">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="library-h" className="t-title">Library</h2>
            <span className="t-caption">{playable.length} of {GAMES.length} playable</span>
          </div>
          <div className="-mx-[var(--gutter)] mb-5 flex gap-2 overflow-x-auto px-[var(--gutter)] pb-1 [scrollbar-width:none]" role="toolbar" aria-label="Filter by category">
            {(["All", ...CATEGORIES] as const).map((c) => (
              <button key={c} className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="game-grid">
            {sorted.map((g) => (
              <Card key={g.id} game={g} best={hydrated ? bests[g.id] : undefined} />
            ))}
          </div>
        </section>

        <footer className="t-caption mt-14 text-center">Everything stays on this device. No account, no tracking.</footer>
      </div>

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
