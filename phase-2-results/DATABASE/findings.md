# Database Findings (PostgreSQL / Neon)

## DB-01 — PASS: Foreign key and index behave correctly

```
$ uv run manage.py dbshell
\d notes_note
```
```
Indexes:
    "notes_note_pkey" PRIMARY KEY, btree (id)
    "notes_note_owner_id_8dafc06d" btree (owner_id)
Foreign-key constraints:
    "notes_note_owner_id_8dafc06d_fk_auth_user_id" FOREIGN KEY (owner_id)
        REFERENCES auth_user(id) DEFERRABLE INITIALLY DEFERRED
```

Django's `ForeignKey` field auto-creates a btree index on `owner_id` —
exactly the column every notes query filters on
(`Note.objects.filter(owner=request.user)`) — with no manual indexing
work needed. The FK constraint itself is real and DB-enforced: Postgres
would reject an `INSERT` referencing a nonexistent user, something the
old MongoDB `owner_id` int could never guarantee.

Confirmed empirically too, not just structurally: `REL-03`'s concurrency
test relies on Postgres's `UNIQUE` constraint on `username` correctly
serializing 5 simultaneous identical-username registration attempts down
to exactly 1 success — that constraint held under a real race.

## DB-02 — ISSUE (LOW): test database teardown fails against the pooled connection

```
psycopg.errors.ObjectInUse: database "test_neondb" is being accessed by other users
DETAIL:  There is 1 other session using the database.
```

**Root cause:** `DATABASE_URL` in `backend/.env` points at Neon's
**pooled** endpoint (hostname contains `-pooler`). Django's test runner
needs to `DROP DATABASE` after the suite finishes, which Postgres
refuses while any session — including one held open by the connection
pooler itself — is still attached.

**Impact:** `test_neondb` was left behind on Neon after the run
(confirmed via `SELECT datname FROM pg_database`). It does **not** touch
the real `neondb` — no application data is affected. It does mean the
same failure will recur on every `manage.py test` run until fixed, which
matters once Phase 3 wires this into CI (an automated pipeline can't
manually clean up after itself the way this session's Bash tool did).

**Recommendation:** use Neon's **direct** (non-pooled) connection string
for admin-style commands (`migrate`, `test`), reserving the pooled
endpoint for the running application's normal request traffic — a common
pattern with any pooled Postgres provider, not specific to Neon.

**Cleanup:** deferred — see `DEFERRED_TESTS.md` #5 (it's a destructive
`DROP DATABASE`, correctly refused by the coding agent's safety
classifier; the command is there for you to run directly).

## Not yet tested

- Actual query performance under realistic data volumes (everything
  tested so far has each user holding a handful of notes)
- Connection pool exhaustion behavior (what happens when concurrent load
  exceeds Neon's pool size — plausible contributor to the auth latency
  in `PERFORMANCE/results.md`, not isolated as a separate variable here)
- Transaction behavior under partial failure (e.g., what happens if the
  request is interrupted mid-`update_one`-equivalent — less of a concern
  now that notes use Django's ORM with real transactions, but not
  explicitly tested)
