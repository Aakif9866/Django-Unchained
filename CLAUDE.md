# SIDEQUEST: task brief and handoff

**Branch:** `10-projects` (an orphan branch, separate from `main`, which holds the older Django Unchained project).
**Status:** all five phases done and verified (2026-11-07). See "State" and "Possible next steps".

## The task

Build **SIDEQUEST**, tagline **"Small tools. Big distractions."**: one Django project hosting independent mini-apps
that share auth and a design system. It should feel like a polished product and work as a portfolio landing page, not
a college CRUD project.

**Stack:** Python, Django, Django ORM, SQLite in dev, PostgreSQL-compatible config. Django templates, HTML, CSS,
vanilla JS, Bootstrap 5, Chart.js. No React, Next.js, Node or other frontend frameworks. DRF only where genuinely
useful (so far it hasn't been: `core/api.py` plus Django forms cover it).

**Hard rules from the brief**
- Every feature really works: no placeholder buttons, fake stats, dummy leaderboards or simulated results.
- Guests can try games and utilities. Saving history, favourites or scores requires login.
- Server-side validation on all forms and endpoints, CSRF protection, proper foreign keys, no committed secrets.
- Each app is independently maintainable. Business logic stays out of views.
- Unit tests for business logic, integration tests for major workflows.
- Don't claim an app is complete until its core workflows are implemented **and tested**. Report limitations honestly.

**Routes:** `/apps/snake/`, `typerush/`, `regex/`, `json-doctor/`, `csv-detective/`, `maze-runner/`, `focusquest/`,
`api-explorer/`, `watch-roulette/`, `colorlab/`, `notes/`.

**Homepage and platform:** branding, search, category filter, card grid with launch actions, recently used, favourites,
global nav, user dashboard, notification system, responsive layouts, custom 404, loading and empty states, theme switch.

| Category | App | Must have |
|---|---|---|
| Play | Snake Arena | Keyboard, start/pause/restart, rising difficulty, levels, obstacles, power-ups, personal best, global leaderboard |
| Play | TypeRush | 30/60/120s, prose and code text, live WPM and accuracy, char highlighting, results, history, leaderboard |
| Play | Maze Runner | Randomized DFS, difficulty levels, keyboard, timer, moves, restart/new, BFS solver, history, leaderboard |
| Build | Regex Playground | JS engine (stated in UI), flags, live highlighting, groups, errors, examples, saved patterns |
| Build | JSON Doctor | Format, minify, validate, error location, tree, copy, download, JSON to CSV and back |
| Build | CSV Detective | Pandas. Upload, preview, counts, missing, duplicates, types, stats, charts, cleaned download, size limits, no signup |
| Build | API Explorer | Backend-executed requests, methods, params, headers, JSON body, status, time, headers, pretty/raw, saved, history. **SSRF protection is mandatory** |
| Focus | FocusQuest | 25/5, 50/10, custom, XP, levels, achievements, streaks, weekly stats, history. **XP must not trust the client** |
| Focus | Notes | Added by the user on top of the original 10 |
| Discover | Watch Roulette | Manual titles, genre, language, rating, watched, wheel, filters, history, favourites. Works with no API key |
| Discover | ColorLab | Generate, lock, HEX and RGB, copy, save/delete, sample page preview, contrast info |

**Phases:** 1 Foundation, 2 Games, 3 Developer utilities, 4 Productivity and entertainment, 5 Integration and quality.

**Design:** use the `frontend-design-aesthetic` skill. The user chose the **Klyro** theme: near-black layered surfaces,
teal workhorse accent, gradient reserved for the brand mark and one main CTA per screen, opposite-corner rounding,
borders over shadows, reveal-on-hover cards, reduced-motion respected, WCAG AA. Tokens live in
`static/css/sidequest.css`; components use tokens, not raw colours. Each app gets one hue through an `.accent-*` class.

## State

All 11 apps are built, tested and documented. Evidence, the bugs testing found, and what was skipped on purpose are in
`PROGRESS.md`. In short:
- 121 Django tests pass on SQLite and on PostgreSQL 16.
- `e2e/smoke.py` runs 199 browser checks, all passing: every app as a guest and signed in, 5 widths × 2 themes, no
  console errors or CSP violations. Its functional checks also pass against gunicorn with `DJANGO_DEBUG=0` on Postgres.
- `README.md`, `PROGRESS.md`, `LEARNING.md`, `docs/decisions.md` and `requirements.txt` exist and match the code.

**Push status:** `git push` to `origin` (owner `Aakif9866`) was refused for the SSH identity `ShuaibAakif`. The user
needs to add that account as a collaborator or push with the owner's key.

## Possible next steps (none are required by the brief)

- TMDB lookup for Watch Roulette, password reset by email, and a shared cache backend for exact rate limits.
- Raise `SECURE_HSTS_SECONDS` and opt into HSTS subdomains and preload once a real domain is chosen.
- Keep `README.md`, `PROGRESS.md` and the smoke test in step with any change.

## Running it

```bash
cp .env.example .env                   # Then set DJANGO_SECRET_KEY. Settings refuse to start without one unless DEBUG is on.
uv sync
uv run python manage.py migrate
uv run python manage.py runserver
uv run python manage.py test           # Harmless warning: "No directory at .../staticfiles/"

# Browser checks use the system Chrome, with the server running on port 8765:
uv run python manage.py runserver 8765 --noreload
uvx --with playwright python e2e/smoke.py     # About 4 minutes. --no-layout skips the width and theme sweep.
```

Restart a `--noreload` server after Python changes. Playwright's `wait_for_function` uses `eval`, which the site's CSP
blocks, so use `Run.until()` in the harness instead. Keep CSP on during tests, so real violations show up.

## Architecture notes

- `core/registry.py` is the single list of apps. `core/api.py` has `api_view`, `validated` and `ApiError` for JSON
  endpoints. `core/ratelimit.py` is a cache-based limiter, so it counts per process under LocMemCache.
- Each app in `apps/<name>/` owns its models, forms, services, urls, tests, templates and static files. Core reads app
  stats only through the dotted `stats` path in the registry.
- `static/js/sidequest.js` exposes `window.SQ` (`el`, `api`, `toast`, `copy`, `download`, `emptyState`, ...). User data
  goes through `textContent`, never `innerHTML`.
- CSP is strict: no inline scripts or `style` attributes in markup. Setting styles from JS through the CSSOM is fine.
- `apps/api_explorer/safe_http.py` is the SSRF guard: every resolved IP must be public, the socket is pinned to the
  checked IP, each redirect is revalidated, and time, size and port limits apply.
- FocusQuest XP comes from the server clock. Game scores are browser-played, so the server can only reject the
  impossible, not prove honesty. Say this plainly in the README.
- Known limits to document: no password reset (needs email), streak days use UTC, rate limits are per process and
  behind a proxy all clients share one bucket, large upload caps belong in the reverse proxy too.

## Working rules for this repo

- Python: always `uv`, never `pip`. Dependencies live in `pyproject.toml` and `uv.lock`.
- Keep it simple: no new dependency or abstraction when the existing stack covers the need.
- Never fabricate results or test evidence. If something fails, show the real error and say whether it's fixed.
- The wider project philosophy (build, test, document, then learn; `LEARNING.md` backlog; `⚡ Built quickly — learn later`
  markers; `docs/decisions.md` for real architectural decisions) is in `main`: `git show main:CLAUDE.md`.
- Commit or push only when asked.
