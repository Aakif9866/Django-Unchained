import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/games/registry";
import { GameFrame } from "@/shell/GameFrame";

export const dynamicParams = false;

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const game = getGame((await params).id);
  return { title: game ? `${game.name} · On Hold` : "On Hold", description: game?.tagline };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getGame(id)) notFound();
  return <GameFrame id={id} />;
}
