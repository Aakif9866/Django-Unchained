# SIDEQUEST: task brief and handoff

**Branch:** `10-projects` (an orphan branch, separate from `main`, which holds the older Django Unchained project).
**Status:** work in progress, stopped partway through Phase 4. See "Where to continue".

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

## Where to continue

Implementation of all 11 apps is written. Verification and documentation are not finished. Do these in order:

1. **Fix the one failing test** (120 of 121 pass): `apps.focusquest.tests.SessionFlowTests.test_session_left_running_does_not_pay`.
   This is a real bug. In `complete_session` (`apps/focusquest/services.py`), the `SessionError` for an overrun session
   is raised inside `transaction.atomic()`, which rolls back the `ABANDONED` save. Decide the outcome inside the block
   and raise after it.
2. **Browser-test the Phase 4 apps.** FocusQuest, Watch Roulette, ColorLab and Notes have passing Django tests, but
   **their JavaScript has never been run in a browser**. Check they load and work, watch for console errors and CSP
   violations, and review screenshots.
3. **Browser-test signed-in flows**, none of which have been exercised end to end: saving a Snake score, TypeRush
   result and Maze run (including playing a maze to completion by keyboard), leaderboards updating, favourites, saved
   regex patterns, saved requests and history in API Explorer, and the dashboard with real data.
4. **Phase 5 checks not yet done:** mobile and tablet layouts (320, 375, 768, 1024, 1920px), light theme contrast (only
   clicked, not reviewed), `collectstatic` with the production manifest storage, a run with `DJANGO_DEBUG=0`, and a run
   on PostgreSQL via `DATABASE_URL`.
5. **Write the end-to-end smoke script** `e2e/smoke.py`. `e2e/harness.py` exists and its docstring already refers to it.
6. **Write the missing docs.** None of these exist yet: `README.md` (everything section 10 of the brief asks for:
   overview, features, stack, architecture, folder structure, install, venv, migrations, superuser, local dev, per-app
   internals, testing, env vars, deployment), `PROGRESS.md`, `LEARNING.md`, `docs/decisions.md`. Generate
   `requirements.txt` with `uv export --no-hashes -o requirements.txt`, because the brief's folder structure lists it.
7. Small cleanup: `apps/watch_roulette/static/watch_roulette/app.js` has a pointless
   `segments.length === 1 ? label : label`, and `.ring-wrap .form-control` in the FocusQuest CSS is unused.

### Verification so far

| Area | Django tests | Browser, as guest | Browser, signed in |
|---|---|---|---|
| Homepage, search, filters, theme toggle | yes | yes | no |
| Snake Arena | yes | start, pause, resume, game over | no |
| TypeRush | yes | typing and highlighting, not a full timed run | no |
| Maze Runner | yes | renders only, not played | no |
| Regex Playground | yes | yes, including killing a catastrophic pattern | no |
| JSON Doctor | page load only (logic checked in browser) | yes | n/a |
| CSV Detective | yes | yes, including cleaned download | n/a |
| API Explorer | yes, including SSRF against a real socket | blocks and one public request | no |
| FocusQuest, Watch Roulette, ColorLab, Notes | yes (one FocusQuest failure) | **not run** | **not run** |

## Running it

```bash
cp .env.example .env                   # Then set DJANGO_SECRET_KEY. Settings refuse to start without one unless DEBUG is on.
uv sync
uv run python manage.py migrate
uv run python manage.py runserver
uv run python manage.py test           # Harmless warning: "No directory at .../staticfiles/"

# Browser checks use the system Chrome, with the server running on port 8765:
uv run python manage.py runserver 8765 --noreload
uvx --with playwright python e2e/smoke.py     # Once smoke.py exists.
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
