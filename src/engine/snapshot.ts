/** Call-mode core: a paused game is written to IndexedDB so it survives the tab being killed. */
import { del, get, keys, set } from "idb-keyval";

export interface Snapshot {
  v: number; // game's snapshot version; a mismatch discards the save instead of crashing
  rng: number;
  game: unknown;
}

const key = (id: string) => `snap:${id}`;

export async function saveSnapshot(id: string, snap: Snapshot) {
  try {
    await set(key(id), snap);
  } catch {
    // Private mode / storage blocked: the game still works, it just can't resume.
  }
}

export async function loadSnapshot(id: string, version: number): Promise<Snapshot | null> {
  try {
    const snap = (await get(key(id))) as Snapshot | undefined;
    return snap && snap.v === version ? snap : null;
  } catch {
    return null;
  }
}

export async function clearSnapshot(id: string) {
  try {
    await del(key(id));
  } catch {}
}

export async function savedGameIds(): Promise<string[]> {
  try {
    return (await keys()).map(String).filter((k) => k.startsWith("snap:")).map((k) => k.slice(5));
  } catch {
    return [];
  }
}
