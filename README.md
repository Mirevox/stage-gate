# Mirevox Stage-gate

Visual stage-and-substage workflows beside any AI harness, with selectable templates and a plain-language **Gatekeeper** that answers “when can I advance?”

Part of [Mirevox](https://github.com/Mirevox) — modular open-source agent control-plane tools.

## Problem

AI harnesses are good at doing work and bad at telling a non-technical person whether the work is ready to move forward. State hides in chat transcripts; spec-only overlays force one methodology; issue trackers sit too far from the agent loop. Stage-gate is a local visual step-and-check layer: pick a template (spec-driven is one of four), walk stages, and get a deterministic Gatekeeper verdict over checks **you** mark done or waive. v1 does not connect to the harness, repo, or CI — it makes blanks and blockers legible so humans can steer without learning Git verbs.

See [docs/problem-statement.md](docs/problem-statement.md).

## What you get (v1)

- Visual stages and substages (appointment-booking style progress)
- Four built-in templates — **not** Spec-only:
  - Spec-driven build
  - Bug fix
  - Prototype / spike
  - Content & ops change
- Gatekeeper checks (`checklist`, `artifact`, `approval`, `harness_signal`) with waive + notes
- Harness as a **labeled context** (Cursor, VS Code + side agent, etc.) — no live harness API yet
- Browser `localStorage` persistence (no database; container is stateless)
- Dark Mirevox UI (`#0b0914` / `#141022` / `#4df0ff` / `#f4f1ff`)

## One-command standup (Docker)

```bash
cp .env.example .env   # optional — defaults are fine
docker compose up --build
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847). Health: `GET /api/health`.

No secrets are baked into the image. Compose publishes `STAGE_GATE_PORT` (default `3847`).

### Gaps (honest)

| Gap | Notes |
| --- | --- |
| Browser-only state | Projects live in `localStorage`; wiping site data or switching browsers loses runs. No server volume yet. |
| No live harness adapters | Checks are user-stated or waived, not observed from Cursor/CI/repo. |
| No export/import | Portable JSON/MD handoff is deferred to v1.1. |
| Trademark caution | “Stage-Gate®” is a third-party mark; this product is Mirevox steps-and-checks, not affiliated. |

## Run locally (Node)

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

```bash
npm test    # Gatekeeper unit smoke
npm run build
npm start   # production Next server on 127.0.0.1:3847
```

## Docs

| Doc | Purpose |
| --- | --- |
| [docs/problem-statement.md](docs/problem-statement.md) | Clear problem we solve |
| [docs/problem-opportunity.md](docs/problem-opportunity.md) | Problem & opportunity (council) |
| [docs/requirements.md](docs/requirements.md) | Locked FR/NFR |
| [docs/architecture.md](docs/architecture.md) | Module boundaries |
| [docs/market-gap.md](docs/market-gap.md) | Competitive gap |
| [docs/devils-advocate.md](docs/devils-advocate.md) | Honest scope challenges |

## Compose with other Mirevox modules

Stage-gate is standalone. Later it pairs with shadow-versioning, context-engine, smart-router, evals, and data-lineage. Sibling modules are not runtime dependencies in v1.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
