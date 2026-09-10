# CLAUDE.md — Project Rules for This Repository

This file governs how Claude (or any AI assistant) works on this project.

## Project Philosophy

**Django Unchained is both a working software project and a learning lab.**

The original goal was to learn every concept while implementing the application step-by-step.

However, due to time/deadline constraints, the current priority is:

> **Get the system built, tested, documented, and working first. Deep learning and understanding can happen afterward.**

Claude may therefore move faster than the original learning-first workflow when necessary.

The project is **not** considered a failure if some implementation details are understood only after they have been built.

The goal is to eventually understand everything that was built.

---

## Prime Directive

When there is a conflict between **learning speed** and **project completion**, prioritize getting the project to a working state while leaving enough documentation and explanation for later learning.

The workflow is now:

```text
Build → Test → Document → Finish → Revisit → Understand Deeply
```

rather than:

```text
Understand Everything → Build → Test → Finish
```

---

## Rules

### 1. Speed Is Allowed

Do not unnecessarily slow down implementation for educational explanations.

If a feature is straightforward or already well understood, implement it efficiently.

If a feature is complex, Claude may implement it first and explain it afterward.

---

### 2. Explain Important Concepts, But Don't Block Progress

For important concepts, provide a concise explanation of:

- What it is
- Why it exists
- Where it is used in this project

Do not require the user to fully understand the concept before continuing.

If deeper understanding would significantly slow development, mark the topic for later learning.

Example:

```text
Built now:
Django ORM relationships

Learn later:
How Django translates ORM operations into SQL
Query optimization
N+1 queries
Indexes
Transactions
```

---

### 3. Don't Hide Complexity

If Claude implements something the user doesn't fully understand, explicitly identify it.

Use:

```text
⚡ Built quickly — learn later
```

for concepts that were implemented primarily to keep development moving.

These should eventually be recorded in `LEARNING.md`.

---

### 4. Don't Fabricate Understanding

Never claim that the user understands something simply because the code works.

A working implementation does not necessarily mean the concept has been learned.

The project therefore tracks two different things:

#### Implementation Progress

What has been built and verified.

#### Learning Progress

What the user actually understands.

These are intentionally allowed to be different.

---

### 5. Architectural Decisions

Explain important architectural decisions briefly.

Record meaningful decisions in:

```text
docs/decisions.md
```

Do not turn every small implementation choice into documentation.

---

### 6. Prefer Existing Architecture

Do not unnecessarily rewrite working code.

Before introducing a new technology, dependency, framework, service, or architectural pattern:

- Check whether the current stack already solves the problem.
- Prefer the simplest solution that works.
- Explain significant architectural changes.

---

### 7. Don't Overengineer

This is a learning project, but it should remain realistic.

Do not introduce:

- Kubernetes
- Microservices
- Kafka
- Redis
- Terraform
- Service meshes
- unnecessary cloud infrastructure

unless there is a strong educational reason.

Target architecture:

```text
React
   ↓
REST API
   ↓
Django + DRF
   ↓
PostgreSQL
   ↓
Docker
   ↓
CI/CD
   ↓
Nginx
   ↓
Monitoring
```

---

## Testing Philosophy

Testing is not just about proving that the application works.

The project should eventually explore:

```text
Correctness
Security
Performance
Scalability
Reliability
Failure handling
Deployment
Observability
```

When time permits, test realistically.

When a test requires substantial external setup, do not block the entire project.

Instead mark it:

```text
DEFERRED
```

and document what would be required to perform it later.

---

## Security Testing

Security testing should be performed only against environments the user is authorized to test.

Useful areas include:

- Authentication
- Authorization
- IDOR
- CSRF
- CORS
- Session security
- Security headers
- Input validation
- API abuse
- Rate limiting
- Information disclosure
- PostgreSQL security
- Docker/container security

Record actual findings and evidence.

Never fabricate vulnerabilities or test results.

---

## Performance Testing

Performance testing should progressively explore:

```text
Baseline
   ↓
Normal Load
   ↓
Increased Load
   ↓
Stress
   ↓
Failure Point
   ↓
Recovery
```

Where practical, capture:

- latency
- throughput
- error rate
- concurrent requests/users
- database performance
- CPU/memory usage
- bottlenecks

If a tool requires significant installation/setup, defer it rather than blocking development.

---

## Documentation

Keep documentation useful and honest.

Important files:

```text
README.md
PROGRESS.md
LEARNING.md
docs/
```

Documentation should reflect the **actual current state** of the project.

Do not leave sections saying "not written yet" once the corresponding work has already been completed.

---

## Learning Backlog

Any concept that was implemented quickly and needs deeper study should be added to:

```text
LEARNING.md
```

Each item should include:

```text
Topic
Where it appears in the project
Why it matters
What I currently understand
What I need to learn
Priority
```

Example:

```text
## Django ORM

Used in:
backend/...

Why:
Database interaction through Django models.

Need to learn:
- QuerySets
- SQL generated by Django
- select_related
- prefetch_related
- indexes
- transactions
- N+1 queries

Priority: HIGH
```

---

## When the User Says "Just Do It"

If the user explicitly asks Claude to execute a task rather than teach it first:

**Execute it.**

Provide:

1. What you're doing
2. What changed
3. Result
4. Important concepts to learn later
5. Any issues/blockers

Do not unnecessarily stop the workflow with educational questions.

---

## Error Handling

Never hide errors.

If something fails:

```text
What failed
Why it failed
What was attempted
What the error means
What was changed
Whether it is fixed
```

Show real errors where useful.

---

## Final Principle

This project is allowed to be built faster than it is understood.

The application is the **lab**.

The documentation is the **record**.

The learning backlog is the **curriculum**.

The goal is not:

> "I understood everything while building it."

The goal is:

> **"I built a realistic system, tested it properly, documented how it works, and can now go back and understand every important part."**
