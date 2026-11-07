# Progress

This file tracks two different things on purpose. **Implementation** is what has been built and verified.
**Learning** is what has actually been understood. Working code doesn't mean the concept has been learned.

## Implementation (verified 2026-11-07)

| Phase | Scope | Status |
|---|---|---|
| 1 Foundation | Settings, URLs, base template, design system, homepage, auth, navigation, cards | Done |
| 2 Games | Snake Arena, TypeRush, Maze Runner, score saving, leaderboards | Done |
| 3 Developer utilities | Regex Playground, JSON Doctor, CSV Detective, API Explorer | Done |
| 4 Productivity and entertainment | FocusQuest, Watch Roulette, ColorLab, plus Notes | Done |
| 5 Integration and quality | Routes, ownership, auth, guest access, layouts, errors, production run | Done |

**Evidence**
- `uv run python manage.py test`: 121 tests pass, on SQLite and on PostgreSQL 16.
- `e2e/smoke.py`: 199 browser checks pass in Chrome. They cover every app as a guest and signed in, five screen widths
  in both themes, and no console errors or CSP violations. The suite's 69 functional checks also pass against
  gunicorn with `DJANGO_DEBUG=0` on PostgreSQL.
- `collectstatic` with the production storage and `check --deploy` both pass. The only warnings are the two HSTS
  opt-ins, left off on purpose.

**Bugs found by testing, all fixed**
- CSV Detective: an all-empty column was reported as `float`.
- CSV Detective: rows ending in a comma made Pandas shift every column left (fixed with `index_col=False`).
- FocusQuest: abandoning an overrun session was rolled back by the error raised inside the same transaction.
- Snake Arena: after pressing Start, the hidden button kept focus and swallowed the Space key.

**Not done, by choice:** TMDB lookup for Watch Roulette, password reset by email, and a shared cache for rate limits.
See "Known limitations" in `README.md`.

## Learning

Nothing below has been assessed yet. See `LEARNING.md` for the backlog and the order to study it in.

| Area | Built | Understood |
|---|---|---|
| Django models, forms, views, URLs | Yes | Not yet assessed |
| Custom user model and auth flows | Yes | Not yet assessed |
| SSRF defence in API Explorer | Yes | Not yet assessed |
| Server-authoritative game rules (FocusQuest) | Yes | Not yet assessed |
| Pandas profiling | Yes | Not yet assessed |
| Maze algorithms (DFS, BFS) | Yes | Not yet assessed |
| Content Security Policy | Yes | Not yet assessed |
| Browser testing with Playwright | Yes | Not yet assessed |
