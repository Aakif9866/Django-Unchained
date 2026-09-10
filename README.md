# Django Unchained — Full-Stack Engineering Lab

A learning project: a small authenticated Notes application, built end to
end — application code, security testing, performance testing, and DevOps —
by a human learner using Claude Code as a mentor, not a code generator.

See `CLAUDE.md` for the ground rules this project is built under, and
`PROGRESS.md` for what has actually been completed so far.

## Project Overview

A Notes app where users can register, log in, and manage their own private
notes. The point of the project isn't the app itself — it's using a
realistic, small application as a vehicle to learn:

1. **Build** — React + Django REST Framework + MongoDB
2. **Test** — automated unit/integration/API tests
3. **Secure** — manual testing with Burp Suite, fixing real vulnerabilities
4. **Load test** — Locust, k6, JMeter
5. **Containerize** — Docker, Docker Compose
6. **Automate** — CI/CD with GitHub Actions
7. **Deploy** — Nginx reverse proxy, a real deployment target
8. **Monitor** — logging and monitoring

## Architecture

_To be filled in as it's built and understood — see `docs/architecture.md`
for the running, detailed version. High level, this is the target:_

```
User → React (Vite) → REST API → Django + DRF → MongoDB
```

## Tech Stack

| Layer      | Choice                     |
|------------|-----------------------------|
| Frontend   | React + Vite                |
| Backend    | Python + Django + DRF       |
| Database   | MongoDB                     |
| Auth       | TBD — decided in Phase 1.7 after comparing session vs JWT |
| Containers | Docker + Docker Compose     |
| CI/CD      | GitHub Actions              |
| Proxy      | Nginx                       |

Reasoning for each choice lives in `docs/decisions.md`.

## Local Setup

_Not written yet — this section fills in as Phase 1 is completed, so it
always reflects a setup that's actually been verified to work._

## Environment Variables

_Not written yet — filled in during Phase 1.7 (auth) and Phase 3.2 (config
management). Nothing here should ever include real secret values._

## Testing

_Not written yet — filled in during Phase 2.3._

## Docker

_Not written yet — filled in during Phase 3.4–3.5._

## Deployment

_Not written yet — filled in during Phase 3.6–3.8._

## Performance Testing

_Not written yet — filled in during Phase 2.4–2.8, results tracked in
`docs/performance.md`._

## Security Testing

_Not written yet — filled in during Phase 2.2, findings tracked in
`docs/security.md`._
