# On Hold v2: going social and online

**Status:** draft, saved 2026-11-20. Nothing here is built yet. v1 (the 32 offline games) comes first.
**Goal:** keep the v1 feel (instant, one-thumb, call mode, dark and colourful) and add identity, people and real time.
The rule of v1 still holds: every game must keep working offline and as a guest. Online features add to the game; they never block playing it.

---

## 1. What v2 adds

| Area | Features |
|---|---|
| **Identity** | Play as guest (default, no sign-up), upgrade a guest to an account without losing progress, sign in with passkey, Google or Apple, or an email magic link |
| **Profile and settings** | Display name, avatar (generated gradient or upload), favourite games, stats per game, privacy (who can see me, who can message me), settings synced across devices (haptics, sound, battery saver, theme) |
| **Synced progress** | Bests, history, recently played, and IndexedDB snapshots synced to the cloud, so you can resume on another device |
| **Social** | Friends (add by code or link), presence (online, in a game, on a call), blocking and reporting |
| **Chat** | 1:1 direct messages, group chats (up to ~50), game-room chat, typing indicators, read receipts, reactions, a quick-reply strip built for one thumb |
| **Real time** | Live multiplayer for Gambit (chess), Four Up, Reversi, Rally and Puck, spectating, invites from chat, rematch |
| **Competition** | Global and friends leaderboards, daily seeded challenge (same seed for everyone), shareable result cards, ghost-race sharing for Drift |
| **Creation** | Level editor for Turnstile and Crates, sharing levels by link |
| **Native** | Optional Capacitor wrapper (native haptics, push notifications for invites and messages) |
| **Hidden modes** | `/auto` (the game plays itself as well as it can) and `/cheat` (infinite lives). Unlinked; see §8 |

---

## 2. Architecture

```
            ┌───────────────────────────────┐
  Browser → │ Next.js app (Vercel)          │  pages, API routes for REST (profile, friends, scores, sync)
  / PWA     │ - static game shell (as v1)   │
            │ - Route Handlers / Server Actions
            └──────────────┬────────────────┘
                           │ REST / RPC
            ┌──────────────▼────────────────┐       ┌──────────────────────┐
            │ Postgres (Neon)               │       │ Object storage       │  avatars, shared levels,
            │ users, profiles, friends,     │       │ (R2 / S3)            │  result cards
            │ messages, scores, saves       │       └──────────────────────┘
            └──────────────▲────────────────┘
                           │
            ┌──────────────┴────────────────┐       ┌──────────────────────┐
  WebSocket │ Realtime service (Node, ws)   │ ◄───► │ Redis                │  pub/sub fan-out across
  ─────────►│ chat, presence, typing,       │       │ presence, rate limits│  instances, caches,
            │ match rooms (authoritative)   │       │ leaderboards (ZSET)  │  matchmaking queue
            └───────────────────────────────┘       └──────────────────────┘
```

**Why a separate realtime service:** Vercel functions can't hold long-lived WebSockets. A small Node service on
Railway or Fly.io keeps the sockets open, and Redis pub/sub lets several instances share rooms. The Next.js app stays
on Vercel and stays mostly static.

**Game logic reuse:** each game's `logic.ts` is already pure, deterministic and JSON-safe. The realtime server imports
the same `logic.ts` and runs the match. The server is authoritative: clients send inputs, the server sends state or
diffs. This blocks cheating at no extra cost. Turn-based games (chess, Four Up, Reversi) just validate moves.
Fast games (Rally, Puck) use a fixed server tick with client prediction and reconciliation.

---

## 3. Tech choices (proposed; to discuss)

| Need | Proposal | Notes |
|---|---|---|
| Auth + guests | **Better Auth** (or Auth.js) with anonymous sessions | A guest gets a real user row with `is_guest`, and "upgrade" links a provider to that row, so nothing has to be migrated |
| Database | **Postgres on Neon** + Drizzle ORM | Branching per pull request for preview deploys |
| Cache / real time | **Redis** (Upstash for serverless REST, or Redis on Railway for the socket service) | Uses below |
| Realtime transport | `ws` (or Socket.IO if we want rooms and reconnection built in) | One protocol message type per feature, all validated with zod |
| Storage | Cloudflare R2 | Avatars and result-card images |
| Push | Web Push (VAPID), FCM/APNs through Capacitor later | Invites and messages only, quiet by default (call mode!) |
| Moderation | Rate limits, a basic profanity filter, report queue, block list | Must exist before group chat ships |

### Where Redis earns its place
- **Presence:** `SET presence:{userId}` with a short TTL refreshed by heartbeats; friends subscribe to changes.
- **Pub/sub:** chat messages and room events fan out across realtime instances.
- **Leaderboards:** `ZADD lb:{game}:{period}`, `ZREVRANGE` for the top N, `ZREVRANK` for "your rank". Postgres stays the
  source of truth, and Redis is rebuilt from it if lost.
- **Caching:** profile cards, friend lists, daily-challenge seeds (read-through, short TTL, invalidated on write).
- **Rate limiting:** sliding window per user and IP for chat, score submits and friend requests.
- **Matchmaking:** a queue per game and rating band; pairs are popped atomically (Lua script or `BLMOVE`).
- **Typing indicators and ephemeral state:** never touch Postgres.

---

## 4. Data model (first pass)

```
users(id, is_guest, created_at, last_seen_at)
profiles(user_id, handle unique, display_name, avatar_url, gradient, bio, privacy jsonb)
settings(user_id, data jsonb, updated_at)                 -- synced device settings
friendships(user_a, user_b, status: pending|accepted|blocked, created_at)
conversations(id, kind: dm|group|room, title, created_by, created_at)
conversation_members(conversation_id, user_id, role, last_read_message_id, muted)
messages(id, conversation_id, sender_id, body, kind: text|invite|system, created_at, edited_at, deleted_at)
reactions(message_id, user_id, emoji)
scores(id, user_id, game_id, score, seed, duration_ms, created_at)   -- verified where possible
saves(user_id, game_id, version, snapshot jsonb, updated_at)          -- synced call-mode snapshots
matches(id, game_id, players jsonb, state jsonb, result, started_at, ended_at)
daily_challenges(date, game_id, seed)
reports(id, reporter_id, target_kind, target_id, reason, status)
```

---

## 5. DevOps

- **Environments:** local (Docker Compose: Postgres + Redis + realtime service), preview (one per PR: Vercel preview plus
  a Neon branch), staging, production.
- **CI (GitHub Actions):** typecheck, lint, Vitest, Playwright smoke against the build, then deploy. Required checks on `main`.
- **Containers:** Dockerfile for the realtime service; the web app stays on Vercel.
- **Infrastructure as code:** Railway or Fly config in the repo; secrets in the platform's secret store, never in git.
- **Database migrations:** Drizzle migrations run in CI before deploy; backwards-compatible first (expand, then contract).
- **Observability:** OpenTelemetry traces (web to API to realtime to Redis and Postgres), Sentry for errors, uptime
  checks, dashboards for socket count, message latency, match tick time and Redis memory.
- **Scaling:** realtime instances are stateless apart from sockets; Redis pub/sub joins them, with sticky sessions at
  the load balancer.
- **Security:** auth on every socket connection (short-lived token), zod validation on every message, rate limits,
  CSP headers, dependency scanning (Dependabot), backups and point-in-time recovery on Postgres.
- **Cost guardrails:** autoscaling caps, alerts on Redis/DB usage, cleanup jobs for guest accounts inactive for 90+ days.

---

## 6. Phases

1. **Foundation:** auth with guests, profiles and settings sync, Postgres + Drizzle, CI/CD pipeline, Docker Compose for local.
2. **Synced progress:** bests, history and snapshots in the cloud, with conflict rule = newest `updated_at` wins and
   a per-game `version` check (already in the registry).
3. **Friends + presence:** friend codes, Redis presence, "on a call" status (call mode already knows).
4. **Chat:** DMs, then group chats, then in-game room chat; moderation and rate limits ship with group chat.
5. **Real-time multiplayer:** turn-based first (Four Up, Reversi, Gambit), then fast games (Rally, Puck) with prediction.
6. **Competition:** leaderboards (Redis sorted sets), daily seeded challenge, share cards, Drift ghost sharing.
7. **Creation + native:** level editor and sharing, Capacitor app with push.

---

## 7. Open questions

- Hosting for the realtime service: Railway or Fly.io? Both are fine; pick on cost and regions.
- Socket.IO (more built in) vs plain `ws` (smaller, more control)?
- How much chat history to keep, and do messages need end-to-end encryption for DMs?
- Minimum age and the moderation policy for group chat.
- Score verification: replay inputs on the server (best, possible because the logic is deterministic) vs trust plus sanity checks.

---

## 8. Hidden modes: auto and cheat

Two unlinked routes for curiosity and testing. **Auto** plays the real game (same random spawns, same traps) as well as a
bot can, so you can watch where ideal play leads, for example Coil filling the entire board. **Cheat** gives infinite lives.
Neither needs accounts or a server, so they can ship at any point in v2 (or late in v1).

**Feasible as is.** The engine already has what this needs: rules are pure and deterministic in `logic.ts`, randomness
comes in through `Rng`, and every game runs through one `GameEnv` and one runtime (`GameFrame`). The real cost is one bot per game.

**Routes.** `/play/[id]/auto` and `/play/[id]/cheat` are static pages built from the same `generateStaticParams`
(96 pages in total). Nothing links to them and they're marked `robots: { index: false }`. Each one renders
`<GameFrame id mode="auto" | "cheat">`.

**Contract change (one field).** Add `GameEnv.mode: "play" | "auto" | "cheat"`, plus an optional pure
`bot(state, rng?) → Action | null` in each `logic.ts`, with tests. In auto mode, `index.ts` calls the bot every tick
and applies its move through the same path as player input, and player input is disabled.

**Runtime (GameFrame).** Auto shows a "Bot" badge and a speed chip (1× / 2× / 4× / 16×, which runs `update` N times per
frame). Neither mode calls `recordRun`, and both use their own snapshot key, so bests and history stay real.

**Cheat semantics.** A death becomes a revive:
- Games with `lives` (Orbit, Fruit Slice, Labyrinth, Brickline): lives never go down.
- One-death games (Coil, Flutter, the runners, Helix Drop, Stack Fall, …): revive in place, with a short window of invulnerability.
- Puzzles, board games and cards have no lives, so cheat there means unlimited undo and hints, or the route isn't offered.

**Bot per category (effort).**
| Category | Approach | Effort |
|---|---|---|
| Board (Four Up, Reversi) | Reuse `src/games/search.ts` at max depth to play the player's side | Small |
| Puzzles | Exact solvers. Nine: backtracking. Lights Out: GF(2) elimination. Nonogram: line solver. Crates: BFS/A*. Minefield: constraint propagation, guessing only when forced. Pipe Flow / Turnstile: search. Twenty48: expectimax. Word Hunt: trie walk. Jigsaw: place in order | Medium |
| Cards (Solitaire, Pairs, Tiles) | Heuristic plus a small lookahead. Pairs remembers every card it has seen | Medium |
| Arcade 2D | Coil: a Hamiltonian cycle with safe shortcuts, guaranteed to fill the board. Rally / Brickline: track the predicted ball. Flutter: aim for the centre of the gap. Stack Fall: a classic placement heuristic. Bubble / Orbit / Fruit Slice: greedy target picking | Medium |
| Action 3D (runners, Hop, Drift, Glide, Helix Drop, Puck, Pocket Golf, Labyrinth) | Lookahead over upcoming obstacles, or a physics shot search for golf. Some bots will be "very good", not perfect | Large |

**Found while checking.** A full Coil board currently ends as `"dead"`: in `src/games/coil/logic.ts`, `spawn()` returns
null and the game counts it as a death. Auto mode would expose this, so add a real **win** state and a "Board cleared"
result. Endless games simply run until the bot slips, or until a time or score cap.

**Rollout.** Pilot with Coil, Four Up and Nine (one bot per kind), then roll out category by category. The bots double as
soak tests in CI, and they fit the §7 idea of replaying inputs on the server.
