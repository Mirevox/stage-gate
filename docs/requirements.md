# Mirevox Stage-gate — Locked Requirements (v1)

**Umbrella:** Mirevox (`https://github.com/Mirevox`)  
**Module:** `stage-gate` — harness-agnostic visual stage-gate workflow and Gatekeeper UI  
**Version:** v1.0 (Locked)  
**Status:** Locked for v1 build, verification, and release  
**Inputs Vetted:**
- `/agent/repos/tmp-51ef90955a03092e/docs/problem-opportunity.md`
- `/agent/repos/tmp-51ef90955a03092e/docs/requirements.draft.md`
- `/agent/repos/tmp-51ef90955a03092e/docs/market-gap.md`
- `/agent/repos/tmp-51ef90955a03092e/docs/devils-advocate.md`
- Current v1 implementation in `/agent/repos/tmp-51ef90955a03092e/src/`

---

## 1. Locked v1 Scope & Product Boundary

**Mirevox Stage-gate v1** is a runnable, standalone **Next.js** web application that gives non-technical and technical users a visual stage-and-substage workflow above any AI coding or work harness.

### In Scope (Locked for v1)
1. **Runnable Next.js web UI** served locally on a single host (`127.0.0.1:3847`) with zero external database, zero container orchestration, and zero mandatory LLM API keys.
2. **Visual stages and nested substages** displayed in an ordered rail with lock/unlock progression and per-stage completion counts.
3. **Four selectable built-in workflow templates** stored as declarative data — explicitly **not** spec-only:
   - `spec-driven` — *Spec-driven build*
   - `bug-fix` — *Bug fix*
   - `prototype` — *Prototype / spike*
   - `content-ops` — *Content & ops change*
4. **Deterministic plain-language Gatekeeper** answering *"When can I advance?"* by evaluating criteria across four kinds (`checklist`, `artifact`, `approval`, `harness_signal`) and returning a structured `AdvanceVerdict` with concrete next actions.
5. **Browser `localStorage` persistence** for projects, criterion states, evidence, notes, and active project selection (no database).
6. **Harness as a labeled context** (selectable preset label + template guidance note), **not** live harness API integration in v1.
7. **Natural, plain-English UX** usable by non-technical stakeholders without Git verbs, CLI commands, or reading raw agent transcripts.

### Explicitly Excluded (v1 & Permanent Non-Goals)
- **No database or server-side state store** (no SQLite, Postgres, or server JSON files in v1).
- **No live harness API integration** (no Cursor/Copilot/Codex/GitHub webhooks, polling, or shell execution in v1).
- **No Spec-only lock-in** (SpecKit/OpenSpec-style workflows are one selectable template among four).
- **No Git UI** (no branches, commits, diffs, or PR operations).
- **No n8n pipelines, Instagram/social automation, or full homelab stack.**
- **No mandatory LLM API keys or paid model dependencies.**

---

## 2. Requirements Vetting Log: Challenging the Draft

Vetting `docs/requirements.draft.md` against the locked v1 slice, `docs/market-gap.md`, and the active v1 codebase uncovered **scope overreach**, **epistemic-honesty risks**, and **functional integrity gaps**. Every item is resolved below.

### 2.1 Draft Requirements Cut or Rescoped for v1

| Draft Item | Draft Claim | Vetting Challenge | Locked v1 Disposition |
| --- | --- | --- | --- |
| **FR-11** (Local persistence + JSON/MD export-import) | Persist across *server restarts* on Cloud VM; support single-file JSON/MD export & re-import. | Locked v1 uses browser `localStorage` with zero DB/server files; server-side storage adds backend complexity not needed for v1 validation. | **Rescoped to FR-09:** Client-side `localStorage` persistence across browser reloads. Portable JSON/MD export-import deferred to **v1.1**. |
| **FR-12 & NFR-08** (REST/JSON API + HTTP `409 Conflict`) | Expose `GET/POST /api/runs`, `/gate`, `/advance`, `/templates`, and `projectId`/`contextRefs` metadata. | With `localStorage` as the v1 store, server-side REST routes have no authoritative backing store. | **Rescoped:** In-process TypeScript module APIs (`templates`, `gatekeeper`, `storage`) with pure domain separation so v2 REST routes wrap the same functions. |
| **FR-04** (Template customization + JSON import/export) | Toggle optional substages per run; upload/validate custom JSON templates at runtime. | Premature UI surface for v1; declarative data-driven templates already prove non-hardcoded extensibility. | **Rescoped to FR-02:** Built-in templates are declarative data (`WORKFLOW_TEMPLATES`) with zero per-template UI branching. Runtime JSON import/export deferred to **v1.1**. |
| **FR-10** (Harness handoff packet generator) | Generate downloadable `.md`/`.json` handoff bundles per substage. | Useful, but outside the locked v1 ship slice. | **Deferred to v1.1.** v1 captures harness label, template `harnessNote`, and per-criterion `evidence`/`note`. |
| **FR-08** (Staleness `needs_review` propagation) | Mark downstream stages `needs_review` whenever an upstream artifact changes. | Requires dependency-graph revision tracking not present in v1 `ProjectState`. | **Rescoped to FR-08:** Dynamic unlocking immediately re-locks downstream advancement if a prior required criterion is reset; downstream evidence is preserved. Granular `needs_review` diff flags deferred to **v1.1**. |
| **FR-03** (3 built-in templates) | 3 engineering-heavy templates (Structured SDLC, SpecKit/OpenSpec, Rapid Prototype). | Narrower than the non-technical promise; `market-gap.md` highlights bug fixes and non-SDLC content/ops work. | **Upgraded to FR-02:** 4 templates (`spec-driven`, `bug-fix`, `prototype`, `content-ops`) proving both non-spec engineering and non-engineering flows. |

### 2.2 Draft & Implementation Gaps Tightened During Vetting (Incorporating Devil's Advocate)

1. **Epistemic honesty — what Gatekeeper actually knows (`market-gap.md` + `devils-advocate.md`):**  
   v1 does **not** observe an agent, repo, CI pipeline, or document, and does **not** judge whether work is "safe to ship." It deterministically checks whether each required criterion on the current step has been marked **met (user-stated)** or **waived (with a reason)**. All four criterion kinds (`checklist`, `artifact`, `approval`, `harness_signal`) are human-attested in v1; `harness_signal` means the user ran a check in their harness and recorded the outcome here. No UI copy or Gatekeeper summary may claim live harness observation or automated verification.
2. **Strict deterministic Gatekeeper — no LLM rule kind or speculative AI plug in v1 (`devils-advocate.md`):**  
   v1 ships **one** pure deterministic evaluator (`askGatekeeper`) with zero model clients, zero API keys, and zero `llm` criterion kinds. Notes never leave the browser. (Any future automated/observed check belongs to v2+ and must explicitly display its source provenance.)
3. **No URL fetching / SSRF avoidance (`devils-advocate.md`):**  
   The `evidence` field stores user-entered links or file paths as plain strings only. Stage-gate must **never** fetch, scrape, or resolve user-entered URLs.
4. **Waiver accountability without arbitrary minimums (`devils-advocate.md` + `criterion-row.tsx`):**  
   Draft FR-07 required an arbitrary 10-character minimum and optional `waivable: false` hard locks. In a single-user v1 app with no admin role, hard locks trap the only human, while `criterion-row.tsx` currently lets a blank click silently fill `"Waived"`. Locked **FR-07** requires a **non-empty user-entered reason** (refusing blank/whitespace-only waivers, no arbitrary character count) and keeps every waiver visibly flagged.
5. **Derived frontier — no manual `needs_review` backdoor (`devils-advocate.md`):**  
   Stage unlock state is derived strictly from current criteria via `isStageUnlocked` / `isSubstageUnlocked`. Resetting an earlier required criterion immediately re-locks downstream advancement without requiring a separate "mark re-verified" button that could paint stale stages green.
6. **Orphaned `blocked` criterion status:**  
   `types.ts` and `gatekeeper.ts` define `blocked` as a first-class `CriterionStatus` alongside `pending`, `met`, and `waived`, and `criterion-row.tsx` styles `blocked` rows, yet no UI control sets `blocked` and `askGatekeeper` does not distinguish `blocked` from `pending` in its summary text. Locked **FR-05** and **FR-06** specify deterministic behavior for all four statuses.
7. **Optional (`required: false`) criteria verification:**  
   All four built-in templates currently set `required: true` on every criterion. The Gatekeeper contract **must** still treat `required: false` criteria as non-blocking advisory items and be covered by automated unit tests (FR-06).
8. **Backtracking UI focus & accidental single-click deletion:**  
   `StageRail` must visually distinguish the *currently viewed* substage from the *furthest unlocked* position (FR-04). Because v1 stores data only in `localStorage` with no server backup, deleting a project requires explicit user confirmation (FR-01, NFR-07).
9. **Naming / trademark & OSS hygiene (`devils-advocate.md`):**  
   `Stage-Gate®` is a registered trademark (Stage-Gate Inc. / R.G. Cooper). Before public OSS release, review naming (prefer descriptive Mirevox copy like *"steps and checks"* over claiming `Stage-Gate` as a standalone brand mark), replace the starter `create-next-app` `README.md` with honest v1 documentation, and add an OSI-approved license file (`Apache-2.0` or `MIT`).

### 2.3 Resolution of Draft Open Questions (and Devil's Advocate Reconciliation)

| Question / Tension | Locked v1 Decision | Reconciliation Note |
| --- | --- | --- |
| **Q1. Persistence backend** | Browser `localStorage` only (no DB, no server disk files), isolated behind `src/lib/storage.ts`. | `devils-advocate.md` prefers server-side JSON files in `data/` so fresh browser profiles see saved runs; v1 locks `localStorage` per the zero-backend v1 build scope and preserves `storage.ts` as the clean seam for a v2 file/SQLite adapter. |
| **Q2. Gate check depth & LLM plug** | 100% deterministic pure-function evaluation over the 4 locked criterion kinds (`checklist`, `artifact`, `approval`, `harness_signal`). No LLM rule kind, no model client, no speculative AI plugin interface in v1. | Fully adopts `devils-advocate.md`: repeatable rules over saved fields only; all v1 outcomes are **user-stated** (`met`) or **waived** (`waived`), never falsely presented as **observed**. |
| **Q3. Template count & mid-run switching** | Four built-in declarative templates (`spec-driven`, `bug-fix`, `prototype`, `content-ops`) chosen at creation and fixed for the project's lifetime. No mid-run switching. | Keeps the 4 locked templates already built for v1 (proving non-spec engineering and non-engineering flows); adopts `devils-advocate.md`'s rule against mid-run switching. |
| **Q4. Visual theme & contrast** | Mirevox dark palette (`#0b0914` canvas, `#141022` panels, `#4df0ff` accent, `#f4f1ff` text) where WCAG AA readability strictly wins over decorative neon, with `prefers-reduced-motion` support. | Adopts `devils-advocate.md`'s contrast-over-aesthetics rule. |
| **Q5. Default waiver policy** | Every criterion is waivable in single-user v1 with a mandatory non-empty user reason (no arbitrary character minimum, no `waivable: false` hard locks). | Fully adopts `devils-advocate.md`: visible accountability without trapping a solo operator. |

---

## 3. Canonical Domain Model (v1)

All v1 modules share these canonical concepts (defined in `src/lib/types.ts`):

| Entity | Definition & Invariants |
| --- | --- |
| `WorkflowTemplate` | Declarative blueprint (`id`, `name`, `tagline`, `audience`, `harnessNote`, `stages[]`). Must contain ≥ 1 `Stage`; each `Stage` must contain ≥ 1 `Substage`; each `Substage` must contain ≥ 1 `GateCriterion`. All `template.id`, `stage.id`, `substage.id`, and `criterion.id` values are unique within their scope (`criterion.id` unique across the template). |
| `GateCriterion` | One readiness check (`id`, `label`, `help`, `kind`, `required`, `howToSatisfy`). `kind` is one of: `checklist`, `artifact`, `approval`, `harness_signal`. |
| `CriterionState` | Mutable state for one criterion in a project: `status` (`pending` \| `met` \| `waived` \| `blocked`), optional `evidence` (path, URL, or short reference), optional `note` (context or waiver rationale), and ISO-8601 `updatedAt`. |
| `ProjectState` | One workflow instance persisted in `localStorage`: `id` (UUID), `name`, `harness` (labeled context string), `templateId`, `createdAt`, `updatedAt`, `criteria` (`Record<criterionId, CriterionState>`), `currentStageId`, `currentSubstageId`. |
| `GateCheckResult` | Evaluated snapshot of one criterion: `criterionId`, `label`, `required`, `status`, `howToSatisfy`, optional `note`, optional `evidence`. |
| `AdvanceVerdict` | Deterministic Gatekeeper output for a `(template, project, stageId, substageId)` tuple: `canAdvance`, `stageId`, `substageId`, `stageName`, `substageName`, plain-language `summary`, partitioned lists (`met[]`, `unmet[]`, `waived[]`), and single plain-language `nextAction`. |

---

## 4. Locked Functional Requirements (v1)

### FR-01: Project Lifecycle & Multi-Project Switching
The application shall allow users to create, resume, switch between, and delete workflow projects entirely in the web UI.

**Acceptance Criteria:**
1. Submitting the new-project form with a selected template and harness creates a `ProjectState` with a unique `id`, ISO-8601 `createdAt`/`updatedAt`, empty `criteria`, and `currentStageId`/`currentSubstageId` set to the template's first stage and first substage.
2. If the project name input is blank or whitespace-only, the system defaults the name to `"Untitled project"` rather than failing or creating an unlabeled entry.
3. Returning to the start/switcher view lists all saved projects showing each project's name, template name, and harness label; clicking **Open** restores that project to its saved position.
4. Deleting a project removes it from storage, clears the active project pointer if it was active, and requires an explicit user confirmation step before permanent removal. *(See Section 8 hardening note.)*

**Verification:** Unit/integration test for storage lifecycle + browser smoke test.

---

### FR-02: Selectable Multi-Path Workflow Templates (Not Spec-Only)
The system shall ship with four distinct declarative workflow templates so users choose rigor appropriate to the work rather than being forced into spec-driven development.

**Acceptance Criteria:**
1. Exactly four built-in templates are selectable at project creation:
   - `spec-driven` (*Spec-driven build*): 4 stages (`pre-req`, `requirements`, `spec`, `build`), 7 substages (`problem`, `hlr`, `fr-nfr`, `adr`, `spec-doc`, `implement`, `verify`), covering `HLR → FR/NFR → ADR → Spec → Build → Verify`.
   - `bug-fix` (*Bug fix*): 2 stages (`triage`, `fix`), 4 substages (`repro`, `isolate`, `patch`, `regress`).
   - `prototype` (*Prototype / spike*): 3 stages (`question`, `explore`, `decide`), 3 substages (`ask`, `hack`, `call`).
   - `content-ops` (*Content & ops change*): 3 stages (`draft`, `review`, `publish`), 4 substages (`outline`, `body`, `check`, `ship`).
2. Each template card on the creation screen displays `name`, `tagline`, and `audience`, and visually indicates the active selection.
3. Selecting `bug-fix`, `prototype`, or `content-ops` allows completing the entire workflow from first substage to final substage without encountering any spec, HLR, FR/NFR, or ADR criterion.
4. All four templates are rendered through a single generic stage/substage/criterion component pipeline with **zero** `if (template.id === ...)` UI branches.

**Verification:** Code inspection + automated template structural integrity test across all 4 templates + browser walkthrough of ≥ 2 distinct templates.

---

### FR-03: Labeled Harness Context (Non-Live in v1)
The system shall record and display the user's chosen AI harness as a labeled context without requiring or pretending to execute live harness API integrations.

**Acceptance Criteria:**
1. Project creation offers at least six selectable harness presets (`Cursor`, `VS Code + side agent`, `GitHub Copilot coding agent`, `Claude / ChatGPT in browser`, `Local CLI agent`, `Other / mixed`) and persists the chosen label on `ProjectState.harness`.
2. The active project header displays both the selected template name and the harness label, and the substage workspace displays the template's `harnessNote`.
3. Zero outbound network requests are made to any IDE, GitHub, OpenAI, Anthropic, or external harness API during normal v1 operation.
4. No UI copy claims that Stage-gate automatically inspected, polled, or verified live harness telemetry; `harness_signal` criteria are clearly framed as checks the user runs in their harness and records in Stage-gate.

**Verification:** Network tab check (0 external API calls) + UI copy inspection.

---

### FR-04: Visual Stage & Substage Stepper Rail
The UI shall render the active template's stages and nested substages as an ordered visual rail showing progress, lock state, and navigation targets at a glance.

**Acceptance Criteria:**
1. Every stage in the template appears in order with its stage number (when unlocked) or lock icon (when locked), stage `name`, `summary`, and a live `done/total` criterion badge (where `done` counts criteria in `met` or `waived` status).
2. Each stage lists its nested substages in order; locked substages render visually dimmed and `disabled` (`button[disabled]`), preventing click navigation.
3. Clicking any unlocked substage loads that substage's criteria and updates the Gatekeeper panel to evaluate that substage without mutating `ProjectState` or losing entered data.
4. The rail clearly distinguishes the currently viewed substage (active focus) from completed stages (`ready` badge state) and locked downstream stages. *(See Section 8 hardening note on viewed-vs-current highlight.)*

**Verification:** Browser UI test across desktop (`1440px`) and split-screen (`768px`) viewports.

---

### FR-05: Plain-Language Substage Workspace & Multi-Kind Criterion Capture
Each substage workspace shall present its criteria in plain language with structured status controls and evidence/note fields covering all four criterion kinds.

**Acceptance Criteria:**
1. Every criterion card displays: `label`, `Required` or `Optional` badge, kind badge (`Checklist`, `Artifact`, `Approval`, or `Harness signal`), plain-English `help`, and `howToSatisfy` guidance.
2. Each criterion supports four domain statuses (`pending`, `met`, `waived`, `blocked`), with distinct visual border/status treatment for `met`, `waived`, and `blocked`, plus a `Reset` action that returns the criterion to `pending` and clears `evidence` and `note`. *(See Section 8 hardening note for exposing `blocked` control in UI.)*
3. Users can enter and edit free-text `evidence` (file path, URL, or reference) and `note` on every criterion; every change persists immediately with an updated ISO-8601 `updatedAt` timestamp.
4. All four criterion kinds (`checklist`, `artifact`, `approval`, `harness_signal`) appear across the built-in templates and render cleanly without technical jargon unexplained.

**Verification:** Automated template coverage check (all 4 kinds present) + browser interaction test.

---

### FR-06: Deterministic Gatekeeper ("When Can I Advance?")
The Gatekeeper shall deterministically evaluate the viewed substage and return a plain-language readiness verdict explaining whether the user can advance and exactly what to do next.

**Acceptance Criteria:**
1. `askGatekeeper(template, project, { stageId, substageId })` partitions the substage's criteria into `met[]`, `waived[]`, and `unmet[]` (preserving `blocked` vs. `pending` status on each unmet item).
2. `canAdvance` is `true` if and only if **zero** criteria with `required: true` remain in `unmet[]`. Unmet criteria with `required: false` appear in `unmet[]` as advisory items and do **not** set `canAdvance` to `false`.
3. Plain-language `summary` and `nextAction` rules:
   - **Can advance, next substage exists:** `summary` explicitly answers yes and names the current substage; `nextAction` names both the next substage and next stage.
   - **Can advance, final substage:** `summary` states the workflow has no further steps; `nextAction` guides finishing or starting a new project.
   - **Cannot advance, 1 required criterion open:** `summary` states one required check is open and names its `label`; `nextAction` surfaces that criterion's `howToSatisfy`.
   - **Cannot advance, N > 1 required criteria open:** `summary` states the exact count `N`; `nextAction` surfaces the first unmet required criterion's `howToSatisfy`.
   - **Invalid `stageId` or `substageId`:** Returns `canAdvance: false` with a safe plain-language fallback message rather than throwing an uncaught exception.
4. The Gatekeeper UI panel updates synchronously on every criterion edit, displays unmet items with their `howToSatisfy` hint, lists met and waived items distinctly, and disables the **Advance to next step** button whenever `canAdvance === false` (or when no next substage exists).

**Verification:** Automated unit tests in `src/lib/gatekeeper.test.ts` covering all 5 verdict branches + browser verification.

---

### FR-07: Controlled Waivers with Visible Audit Distinction
Users shall be able to waive a criterion when appropriate without disguising a waiver as verified completion.

**Acceptance Criteria:**
1. Setting a criterion to `waived` moves it into `verdict.waived[]` (never `verdict.met[]`) and allows `canAdvance` to pass for that criterion.
2. In the Gatekeeper panel and criterion workspace, waived criteria display an unmistakable amber **Waived** badge/accent distinct from green **Met** checks.
3. Waiving a criterion records an explicit user-authored rationale in `CriterionState.note` (non-empty trimmed string, not an empty/silent click) and records `updatedAt`. *(See Section 8 hardening note.)*

**Verification:** Unit test verifying `met` vs `waived` partitioning + browser test of waiver flow.

---

### FR-08: Progressive Unlocking, Advancement & Backtracking Integrity
Stage and substage unlock state shall be derived deterministically from gate readiness so users cannot bypass unresolved gates and can safely backtrack to revise earlier steps.

**Acceptance Criteria:**
1. `isStageUnlocked(template, project, stageId)` returns `true` if and only if every substage in every preceding stage evaluates to `canAdvance === true`. Stage 0 is always unlocked.
2. `isSubstageUnlocked(template, project, stageId, substageId)` returns `true` if and only if the parent stage is unlocked and every preceding substage in that stage evaluates to `canAdvance === true`.
3. Clicking **Advance to next step** when `canAdvance === true` moves to `nextSubstage(template, stageId, substageId)`, persists `currentStageId`/`currentSubstageId`, and focuses the new substage in the workspace.
4. If a user navigates back to an earlier substage and resets a required criterion to `pending` (or `blocked`), all downstream stages/substages immediately re-evaluate as locked without deleting any previously recorded downstream `criteria` entries; re-satisfying the earlier criterion restores unlock status with downstream records intact.

**Verification:** Automated unit tests for `isStageUnlocked`, `isSubstageUnlocked`, `nextSubstage`, `previousSubstage`, and backtrack-reset preservation.

---

### FR-09: Client-Side LocalStorage Persistence
All project data shall persist locally in browser `localStorage` with zero external database or server storage requirements.

**Acceptance Criteria:**
1. Projects are stored under `mirevox.stage-gate.projects` and active selection under `mirevox.stage-gate.active`.
2. Creating a project, updating criterion status/evidence/note, and advancing substages survive a full browser page reload (`F5` / hard refresh) on the same origin with zero data loss.
3. Storage helpers safely no-op / return empty defaults during Next.js server-side rendering (`typeof window === "undefined"`), causing zero SSR hydration crashes.
4. If `mirevox.stage-gate.projects` contains malformed JSON, `listProjects()` catches the parse error and returns `[]` cleanly instead of crashing the UI.

**Verification:** Browser reload persistence test + SSR build check + malformed-storage recovery test.

---

## 5. Locked Non-Functional Requirements (v1)

| ID | Category | Requirement | Measurable Acceptance Criterion | Verification Method |
| --- | --- | --- | --- | --- |
| **NFR-01** | Non-Technical Usability | Plain-English, self-explanatory workflow with zero Git or CLI prerequisites for the browser user. | Browser flows require `0` Git verbs (`commit`, `branch`, `rebase`, `stash`, `cherry-pick`) and `0` terminal commands; 100% of built-in criteria include non-empty plain-language `help` and `howToSatisfy` strings; abbreviations (`HLR`, `FR/NFR`, `ADR`) include plain-English context in the substage summary or criterion help. *(Only the operator starting the app runs `npm install` / `npm run dev`.)* | Manual walkthrough + automated template text assertion. |
| **NFR-02** | Runnable Footprint | Single-host runnable Next.js app with zero homelab or DB setup. | Fresh install and production startup (`npm install && npm run build && npm start`) or dev startup (`npm run dev`) succeeds on a single Linux host bound to `127.0.0.1:3847` with `0` database services, `0` Docker containers, and `0` external API keys configured. | Clean build & HTTP 200 check against `http://127.0.0.1:3847`. |
| **NFR-03** | Responsiveness | Synchronous local Gatekeeper evaluation without lag. | `askGatekeeper`, `stageProgress`, and `isStageUnlocked` run synchronously in-memory with zero network I/O, updating the Gatekeeper panel immediately on criterion edits with no loading spinner or perceptible delay. | Unit test (no async/network) + interactive browser check. |
| **NFR-04** | Epistemic Honesty, Privacy & Zero Lock-In | Zero vendor lock-in, no data exfiltration, and honest evidence provenance. | 100% of FRs pass completely offline (after local server start) with `0` LLM API keys, `0` model clients in `src/`, and `0` outbound URL fetches of user-entered `evidence` strings (preventing SSRF and data leakage); UI never labels user-entered `harness_signal` status as "auto-verified by harness" or claims work is "safe to ship." | Offline browser run + static grep for network/model clients + copy audit. |
| **NFR-05** | Accessibility & Layout | Keyboard-usable, readable, and workable beside an IDE. | All interactive controls (template cards, harness presets, rail buttons, criterion actions, inputs, advance button) are reachable via `Tab` and activatable via `Enter`/`Space`; text meets WCAG AA contrast (`>= 4.5:1` for body text on `--bg`/`--panel`); `prefers-reduced-motion: reduce` disables panel entrance animation; layout renders without horizontal overflow at `1440px` desktop and `768px` split-screen width. | Keyboard walkthrough + responsive viewport inspection + CSS check. |
| **NFR-06** | Modularity & Code Health | Strict separation between pure domain logic, storage, and UI. | `src/lib/types.ts`, `src/lib/templates.ts`, and `src/lib/gatekeeper.ts` contain `0` imports of `react`, `next/*`, or browser globals (`window`, `localStorage`, `document`); `npm run lint` and `npx tsc --noEmit` exit with code `0` and `0` errors. | Static import check + `tsc --noEmit` + `npm run lint`. |
| **NFR-07** | Reliability & Storage Safety | Resilient browser persistence and protection against accidental data loss. | Zero uncaught exceptions on SSR render, empty `localStorage`, or corrupt JSON in `localStorage`; `localStorage.setItem` quota errors are caught and surfaced cleanly rather than throwing unhandled exceptions; destructive project deletion requires user confirmation. | Unit/fault-injection check + browser test. |
| **NFR-08** | Docker & Control-Plane Readiness | Clean packaging and integration seams without blocking v1. | Zero hardcoded host filesystem paths in `src/`; all persistence flows exclusively through `src/lib/storage.ts`; `next.config.ts` and server startup remain compatible with Next.js `output: "standalone"` containerization and future `PORT`/`HOSTNAME` env configuration. | Code review against `docs/architecture.md`. |

---

## 6. Non-Goals & Deferred Roadmap

### Permanent Non-Goals (Out of Scope)
- Building an AI agent runtime, foundation model, or shell execution sandbox.
- Replacing Git or exposing Git repository management verbs in the UI (`shadow-versioning` handles cross-tool versioning in the Mirevox ecosystem).
- n8n workflow orchestration, Instagram/social-media publishing pipelines, or full homelab infrastructure management.
- Enterprise multi-tenant billing, compliance portals, or cloud infrastructure provisioning (Terraform/IaC).

### Deferred Post-v1 Roadmap
| Target | Deferred Capability | Why Deferred from v1 |
| --- | --- | --- |
| **v1.1** | Harness Handoff Packet generator (copy/export `.md`/`.json` context bundle per substage) | Adds high value for copy-paste harnesses without blocking core visual stepper + Gatekeeper validation. |
| **v1.1** | Portable Project Export/Import (single JSON file + readable Markdown summary) | Mitigates `localStorage` single-browser confinement once v1 core UX is proven. |
| **v1.1** | Custom template JSON import/export & per-run optional substage toggles | Declarative template schema is already in place; UI authoring editor can follow. |
| **v1.1** | Granular `needs_review` downstream staleness banners & per-criterion `waivable: false` policy | Refines backtracking and governance once baseline workflow ergonomics are validated. |
| **v2.0** | Swappable server persistence adapter (local JSON file or SQLite) + Next.js Route Handlers (`/api/templates`, `/api/projects`, `/api/projects/:id/gate`) | Enables multi-browser access, CI/CLI inspection, and HTTP `409 Conflict` enforcement. |
| **v2.0** | Live harness adapters (Cursor, GitHub/CI, Copilot, CLI) populating verified `harness_signal` evidence with provenance | Requires per-harness adapter maintenance; v1 proves the normalized criteria model first. |
| **v2.0** | Mirevox control-plane hooks (`projectId` for `shadow-versioning`, `contextRefs` for `context-engine`, async `evals`/`smart-router` evaluators) & Docker image | Clean module boundaries in v1 keep v2 integration additive. |

---

## 7. Measurable v1 Ship Exit Criteria

v1 is ready to declare **done** only when **every** gate below passes with recorded evidence:

| Exit ID | Gate | Objective Pass Condition |
| --- | --- | --- |
| **EX-01** | Production Build | `npm run build` exits `0` with zero TypeScript or Next.js bundling errors. |
| **EX-02** | Lint & Static Check | `npm run lint` and `npx tsc --noEmit` exit `0`. |
| **EX-03** | Gatekeeper & Template Test Suite | `npm test` exits `0` and verifies: all 4 built-in templates structurally valid (unique IDs, all 4 criterion kinds covered, non-empty `help`/`howToSatisfy`); empty substage blocks advancement; `required: false` unmet criterion does not block; `met` and `waived` partition cleanly; `blocked` stays in `unmet`; `isStageUnlocked` / `isSubstageUnlocked` lock/unlock accurately including backtrack reset; invalid stage/substage returns safe verdict. |
| **EX-04** | Multi-Template End-to-End Smoke | In a live browser against the running Next.js app (`http://127.0.0.1:3847`): create a `spec-driven` project AND a non-spec project (`bug-fix` or `content-ops`), observe Gatekeeper blocking advancement with plain-language `nextAction`, satisfy/waive criteria with evidence/notes, advance through stages, and verify `0` console errors and `0` external API calls. |
| **EX-05** | Reload Persistence & Backtrack | Reload the browser page mid-workflow and verify project, criteria, evidence, notes, and unlocked stages persist intact; navigate back to a prior substage, reset a required check, and verify downstream stages re-lock without losing entered downstream data. |
| **EX-06** | Responsive & Keyboard Check | Verify no horizontal overflow at `1440px` and `768px` widths and full keyboard traversal (`Tab`/`Enter`) from project creation through stage advancement. |
| **EX-07** | Honest Docs, License & Zero Hidden Calls | Replace the starter `create-next-app` `README.md` with accurate v1 startup/scope documentation (explicitly noting checks are user-stated/waived, local-only, and non-connected to live harnesses), add an OSI license (`Apache-2.0` or `MIT`), and verify `src/lib/` imports zero network or LLM SDKs. |

---

## 8. Known v1 Hardening Items (Current Codebase vs. Locked Spec)

During requirements vetting of `/agent/repos/tmp-51ef90955a03092e/src/` and repo root, eight concrete, small-surface hardening gaps were identified between the initial v1 scaffold and the locked criteria above:

1. **Waiver rationale enforcement (`src/components/stage-gate/criterion-row.tsx`):** Clicking *Waive* currently auto-fills `"Waived"` when `note` is empty, contradicting the *"Note (required when waiving)"* label and **FR-07.3**. Refuse blank/whitespace-only waivers and prompt/focus the note input before setting `status: "waived"`.
2. **`blocked` status control & verdict phrasing (`src/components/stage-gate/criterion-row.tsx`, `src/lib/gatekeeper.ts`):** `blocked` is modeled in `types.ts` and styled in `CriterionRow`, but lacks a UI action button and explicit mention in `askGatekeeper`'s summary (**FR-05.2**, **FR-06.1**).
3. **Viewed vs. current substage highlight (`src/components/stage-gate/stage-rail.tsx`, `src/components/stage-gate/app-shell.tsx`):** `StageRail` highlights `project.currentStageId`/`project.currentSubstageId` instead of the currently viewed `viewStageId`/`viewSubstageId`, causing visual confusion when backtracking (**FR-04.4**).
4. **Destructive delete confirmation (`src/components/stage-gate/app-shell.tsx`):** Clicking **Delete** immediately removes the project from `localStorage` without confirmation (**FR-01.4**, **NFR-07**). Add a two-step inline confirm or dialog.
5. **Storage quota error guard (`src/lib/storage.ts`):** `saveAll()` calls `localStorage.setItem` without a `try/catch` for `QuotaExceededError` (**NFR-07**). Wrap writes defensively.
6. **Unit test coverage (`src/lib/gatekeeper.test.ts`):** Current test covers only `bug-fix` empty → met → next. Expand to cover all **EX-03** cases (4 templates, optional criteria, waived vs. met, blocked status, backtracking unlock, invalid stage fallback).
7. **Starter README & missing license (`README.md`, `LICENSE`):** Root `README.md` is still the stock `create-next-app` template referencing port `3000` and Vercel deployment, and no `LICENSE` file exists (**EX-07**).
8. **Trademark review before public release:** `Stage-Gate®` is a registered mark (Stage-Gate Inc. / R.G. Cooper); confirm naming/copy posture (prefer descriptive Mirevox phrasing) before publishing the public OSS repository.
