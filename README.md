# Mirevox Stage-gate

Visual stage-and-substage workflows on top of any AI harness, with selectable templates and a plain-language **Gatekeeper** that answers “when can I advance?”

Part of [Mirevox](https://github.com/Mirevox) — modular open-source agent control-plane tools.

## What you get (v1)

- Visual stages and substages (appointment-booking style progress)
- Four built-in templates — **not** Spec-only:
  - Spec-driven build
  - Bug fix
  - Prototype / spike
  - Content & ops change
- Gatekeeper checks (`checklist`, `artifact`, `approval`, `harness_signal`) with waive + notes
- Harness as a labeled context (Cursor, VS Code + side agent, etc.) — no live harness API yet
- Browser `localStorage` persistence (no database)

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

```bash
npm test    # Gatekeeper unit smoke
npm run build
```

## Docs

| Doc | Purpose |
| --- | --- |
| [docs/problem-opportunity.md](docs/problem-opportunity.md) | Problem & opportunity |
| [docs/requirements.md](docs/requirements.md) | Locked FR/NFR |
| [docs/architecture.md](docs/architecture.md) | Module boundaries |
| [docs/market-gap.md](docs/market-gap.md) | Competitive gap |
| [docs/devils-advocate.md](docs/devils-advocate.md) | Honest scope challenges |

## Compose with other Mirevox modules

Stage-gate is standalone. Later it pairs with shadow-versioning, context-engine, smart-router, evals, and data-lineage.

## License

MIT
