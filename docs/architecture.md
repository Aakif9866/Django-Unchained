# Architecture

## High-Level Request Flow

```
User
 ↓
React (Vite dev server / built static assets)
 ↓
HTTP / REST API (JSON over HTTP)
 ↓
Django
 ↓
Django REST Framework (serialization, views, permissions)
 ↓
MongoDB (via an ODM — library choice explained in docs/decisions.md)
```

### What each layer does

- **React** — renders the UI in the browser, holds client-side state (e.g.
  "is the user logged in", "what notes are loaded"), and makes HTTP
  requests to the Django API. It does not talk to MongoDB directly — ever.
- **REST API** — the contract between frontend and backend: a set of URLs
  (`/api/notes/`, `/api/auth/login/`, ...) that accept/return JSON and use
  HTTP methods (GET/POST/PUT/PATCH/DELETE) to mean specific things.
- **Django** — the web framework: routes incoming HTTP requests (via
  `urls.py`) to Python functions/classes (views), and returns HTTP
  responses. Also owns settings, middleware (code that runs on every
  request/response), and (normally) the ORM — though here MongoDB replaces
  the relational ORM, which is a deliberate deviation covered in
  `docs/decisions.md`.
- **Django REST Framework (DRF)** — a layer on top of Django specifically
  for building APIs: serializers (convert between Python objects and
  JSON, with validation), API views/viewsets, authentication classes,
  permission classes.
- **MongoDB** — a document database. Stores users' notes as JSON-like
  documents rather than rows in tables. No foreign keys, no joins — data
  modeling works differently than in a relational database like
  PostgreSQL, which matters for how we structure notes and authorization.

## Request Lifecycle Examples

_These will be filled in with real detail once each piece exists — for now,
conceptually:_

### User opens the application
```
Browser requests React app
 ↓
Vite serves index.html + JS bundle
 ↓
React checks: is there a valid session/token?
 ↓
If yes → fetch current user + notes
If no  → show login/register screen
```

### User registers
```
React form submit
 ↓
POST /api/auth/register/  { username, password }
 ↓
DRF serializer validates input
 ↓
Django hashes the password (never stored in plain text)
 ↓
User document created in MongoDB
 ↓
Response: success (or validation errors)
```

### User logs in
```
POST /api/auth/login/  { username, password }
 ↓
Django checks credentials against stored password hash
 ↓
On success: issue session cookie or token (mechanism TBD — Phase 1.7)
 ↓
Frontend stores/relies on that credential for future requests
```

### User creates a note
```
POST /api/notes/  { title, content }  (with auth credential attached)
 ↓
DRF permission check: is this request authenticated?
 ↓
Serializer validates title/content
 ↓
Note document created in MongoDB, tagged with the owning user's id
 ↓
Response: the created note (with its id)
```

### User retrieves notes
```
GET /api/notes/  (with auth credential attached)
 ↓
DRF permission check: authenticated?
 ↓
Query MongoDB for notes WHERE owner == current user
 ↓
Response: list of the user's notes only
```

This last step is where **authorization** (as opposed to authentication)
matters: being logged in only proves who you are, not what you're allowed
to see. `GET /api/notes/123` must check that note 123 belongs to the
requesting user before returning it — otherwise it's an IDOR vulnerability,
which we intentionally test for in Phase 2.

### User logs out
```
POST /api/auth/logout/
 ↓
Server invalidates the session / client discards the token
 ↓
Frontend clears local state, redirects to login
```

## Authentication Flow

_Filled in once the session-vs-JWT decision is made in Phase 1.7._

## Database Flow

_Filled in once the MongoDB integration (ODM/driver choice) is made in
Phase 1.5._

## Docker Architecture

_Filled in during Phase 3.4–3.5._

## Deployment Architecture

_Filled in during Phase 3.6–3.8._
