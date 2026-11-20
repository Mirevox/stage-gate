# Mirevox Stage-gate — Architecture Narrative (v1)

**Umbrella:** Mirevox (`https://github.com/Mirevox`)  
**Module:** `stage-gate`  
**Version:** v1.0  
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 3 · Radix UI · Browser `localStorage`  
**Companion Spec:** `docs/requirements.md`  
**License:** Apache-2.0

---

## 1. Architectural Philosophy & Design Drivers

Mirevox Stage-gate sits **above** AI coding and work harnesses as a human-facing governance and readiness layer. Its v1 architecture is shaped by four deliberate constraints:

1. **Zero-infrastructure local runnability:** v1 runs as a single Next.js web application on one host (`127.0.0.1:3847`) with browser `localStorage` persistence. No database server, no background workers, no Docker daemon, and no external API keys are required to start or use it.
2. **Pure deterministic domain core:** Workflow definitions (`templates`) and gate evaluation (`gatekeeper`) are pure TypeScript modules with zero React, Next.js, network, or browser-storage dependencies. The exact same domain code that runs in the browser today can run inside Node.js unit tests (`tsx`), Next.js Route Handlers, or a standalone Mirevox control-plane service tomorrow.
3. **Methodology as data, not UI code:** Spec-driven development is one selectable template (`spec-driven`) alongside `bug-fix`, `prototype`, and `content-ops`. The UI has zero template-specific branches; adding a new workflow means adding declarative data conforming to `WorkflowTemplate`.
4. **Honest boundaries for v1, clean seams for v2:** In v1, the AI harness is a labeled context and `harness_signal` criteria are human-attested. Persistence is isolated behind a thin repository module (`storage.ts`) so swapping `localStorage` for a server API/database or plugging in live harness adapters in v2 requires replacing adapters, not rewriting the domain or UI.

---

## 2. System Overview & Module Boundaries

Stage-gate v1 is organized into **four primary functional modules** plus a **shared types kernel**, forming a strict directed acyclic dependency graph (DAG):

```
+-------------------------------------------------------------------+
|  UI Layer  (src/app/*, src/components/stage-gate/*, ui/*)         |
|  - AppShell (orchestration, hydration, viewed vs active state)    |
|  - NewProjectForm (onboarding, template & harness picker)         |
|  - StageRail (visual stage/substage stepper & progress badges)    |
|  - CriterionRow (4 criterion kinds, status/evidence/note capture) |
|  - GatekeeperPanel ("When can I advance?" verdict & advance CTA)  |
+----------+--------------------+--------------------+--------------+
           |                    |                    |
           v                    v                    v
+-------------------+  +-------------------+  +---------------------+
| Templates Module  |  | Gatekeeper Module |  | Storage Adapter     |
| src/lib/          |  | src/lib/          |  | src/lib/storage.ts  |
| templates.ts      |  | gatekeeper.ts     |  | - localStorage CRUD |
| - 4 declarative   |  | - askGatekeeper() |  | - SSR guards        |
|   templates       |  | - stageProgress() |  | - HARNESS_PRESETS   |
| - lookup helpers  |  | - unlock checks   |  | - project mutations |
|                   |  | - next/prev nav   |  |                     |
+---------+---------+  +---------+---------+  +----+-----------+----+
          |                      |                 |           |
          |                      |                 +-----+     |
          v                      v                       v     v
+-------------------------------------------------------------------+
|  Domain Types Kernel  (src/lib/types.ts)                          |
|  WorkflowTemplate, Stage, Substage, GateCriterion, ProjectState,  |
|  CriterionState, GateCheckResult, AdvanceVerdict                  |
+-------------------------------------------------------------------+
```

### Strict Boundary Rules

| Module | File(s) | Owns | Forbidden Dependencies |
| --- | --- | --- | --- |
| **Types Kernel** | `src/lib/types.ts` | Canonical domain interfaces and union types (`CriterionKind`, `CriterionStatus`, `StageStatus`, `WorkflowTemplate`, `ProjectState`, `AdvanceVerdict`). | Must import **nothing** (zero runtime code, zero external packages). |
| **Templates** | `src/lib/templates.ts` | Built-in declarative template catalog (`WORKFLOW_TEMPLATES`) and read-only query helpers (`getTemplate`, `firstStageSubstage`, `listAllCriteria`). | No React, no Next.js, no `window`/`localStorage`, no mutable project state. |
| **Gatekeeper** | `src/lib/gatekeeper.ts` | Deterministic readiness evaluation (`askGatekeeper`), progress aggregation (`stageProgress`), traversal (`nextSubstage`, `previousSubstage`), and lock calculation (`isStageUnlocked`, `isSubstageUnlocked`). | No React, no Next.js, no `window`/`localStorage`, no network I/O, no state mutation. All functions are pure and referentially transparent. |
| **Storage** | `src/lib/storage.ts` | Browser `localStorage` persistence (`mirevox.stage-gate.projects`, `mirevox.stage-gate.active`), SSR availability guard, project creation/update/advance/delete helpers, and `HARNESS_PRESETS`. | No React components, no Gatekeeper UI formatting. Only module permitted to touch `window.localStorage`. |
| **UI Layer** | `src/app/*`, `src/components/*` | Layout, Mirevox visual theme, client hydration, user interactions, accessibility, and composing Templates + Gatekeeper + Storage into the interactive workbench. | Must never access `localStorage` directly (must go through `storage.ts`) and must never re-implement gate unlock math inline (must call `gatekeeper.ts`). |

---

## 3. Module Deep Dive

### 3.1 Domain Types (`src/lib/types.ts`)
The data model cleanly separates three concerns:

1. **Static workflow definition (Blueprint):** `WorkflowTemplate → Stage[] → Substage[] → GateCriterion[]`. Every criterion carries a `kind` (`checklist | artifact | approval | harness_signal`), a `required` boolean, and two non-technical guidance strings (`help` and `howToSatisfy`).
2. **Mutable run state (Instance):** `ProjectState` stores metadata (`id`, `name`, `harness`, `templateId`, timestamps), navigation position (`currentStageId`, `currentSubstageId`), and a flat map `criteria: Record<criterionId, CriterionState>`. Keeping `criteria` as a flat dictionary keyed by `criterionId` makes reads `O(1)`, avoids deeply nested state cloning, and preserves downstream records cleanly if a user backtracks and temporarily re-locks a later stage.
3. **Derived evaluation output (Verdict):** `AdvanceVerdict` and `GateCheckResult` are ephemeral, recomputed on demand from `(WorkflowTemplate, ProjectState)`. Verdict state is **never** persisted to storage, eliminating stale-cache bugs by construction.

### 3.2 Templates Module (`src/lib/templates.ts`)
Templates are declarative TypeScript data structures (trivially serializable to/from JSON) shipping four distinct workflows:

- **`spec-driven`** (*Spec-driven build*): 4 stages, 7 substages (`problem` → `hlr` → `fr-nfr` → `adr` → `spec-doc` → `implement` → `verify`). Uses all four criterion kinds (`artifact`, `checklist`, `approval`, `harness_signal`).
- **`bug-fix`** (*Bug fix*): 2 stages, 4 substages (`repro` → `isolate` → `patch` → `regress`). Uses all four criterion kinds without requiring any formal spec or ADR.
- **`prototype`** (*Prototype / spike*): 3 stages, 3 substages (`ask` → `hack` → `call`). Optimizes for timeboxed learning and explicit keep/pivot/stop decisions.
- **`content-ops`** (*Content & ops change*): 3 stages, 4 substages (`outline` → `body` → `check` → `ship`). Serves non-engineers shipping copy, docs, or operational runbooks.

Because templates are plain data, v1.1 custom template import only needs a runtime schema validator (e.g., Zod) feeding into the exact same `WorkflowTemplate` contract.

### 3.3 Gatekeeper Engine (`src/lib/gatekeeper.ts`)
The Gatekeeper answers one core user question: **"When can I advance?"**

- **Evaluation rule:** For a target substage, each `GateCriterion` is joined with `project.criteria[c.id] ?? { status: "pending" }` and partitioned into:
  - `met[]` (`status === "met"`)
  - `waived[]` (`status === "waived"`)
  - `unmet[]` (`status === "pending"` or `"blocked"`)
- **Advancement condition:** `canAdvance = unmet.filter(u => u.required).length === 0`. Optional criteria (`required: false`) remain visible in `unmet[]` as advisory guidance without blocking progress.
- **Plain-language synthesis:** `askGatekeeper` translates the structured result into a one-sentence `summary` and a single concrete `nextAction` (either naming the next substage/stage when ready, noting workflow completion on the final substage, or surfacing the exact `howToSatisfy` guidance for the first open required check).
- **Computed unlocking (key invariant):** `isStageUnlocked` and `isSubstageUnlocked` walk the template from Stage 0 up to the target and verify `canAdvance === true` for every preceding substage. Unlock status is **never** stored as a separate boolean array; therefore, resetting an earlier required check automatically re-locks downstream advancement while leaving downstream evidence intact in `project.criteria`.

### 3.4 Storage Adapter (`src/lib/storage.ts`)
v1 persistence runs entirely inside the user's browser via `window.localStorage`:

- **Keys:**
  - `mirevox.stage-gate.projects`: JSON array of `ProjectState` objects (most recently created first).
  - `mirevox.stage-gate.active`: active `ProjectState.id` string.
- **SSR safety:** `canUseStorage()` checks `typeof window !== "undefined" && !!window.localStorage` so Next.js server pre-rendering never throws `ReferenceError`.
- **Corruption resilience:** `listProjects()` wraps `JSON.parse` in `try/catch` and falls back to `[]`. *(Hardening note: `saveAll()` should likewise wrap `localStorage.setItem` to catch `QuotaExceededError` cleanly.)*
- **Trade-offs accepted for v1:** Data is scoped to one browser profile and origin (~5 MB typical quota), with no multi-tab locking or cross-device sync. These are intentional v1 simplifications; because all UI mutations route through `storage.ts`, migrating to a server-backed async repository in v2 does not touch `templates.ts` or `gatekeeper.ts`.

### 3.5 Web UI Layer (`src/app/` & `src/components/stage-gate/`)
- **Entry & Rendering Strategy:** `src/app/page.tsx` renders `<AppShell />` (`"use client"`). `AppShell` defers reading `localStorage` until `useEffect` sets `hydrated = true`, preventing React hydration mismatches between server HTML and client storage.
- **Two Top-Level Views:**
  1. **Onboarding / Project Switcher (`NewProjectForm` + Resume list):** Shown when no active project is selected. Captures project name, template choice (4 cards), and harness preset label.
  2. **Three-Column Workbench:** Desktop `lg:grid-cols-[260px_minmax(0,1fr)_300px]` stacking gracefully on narrower/split-screen viewports (`768px` beside an IDE):
     - Left: `StageRail` (stage/substage stepper, progress badges, lock icons).
     - Center: Active substage header + `CriterionRow` list (status actions, `evidence` and `note` fields).
     - Right: `GatekeeperPanel` ("When can I advance?", plain-language summary, `Next action` callout, unmet/met/waived breakdown, and guarded **Advance to next step** button).
- **Visual System:** Dark Mirevox palette (`--bg: #0b0914`, `--panel: #141022`, `--neon: #4df0ff`, `--purple: #7c5cff`, `--text: #f4f1ff`), Fraunces display typography paired with Source Sans 3 body copy, and `@media (prefers-reduced-motion: reduce)` support.

---

## 4. In-Process APIs (v1) & v2 Evolution Seam

In v1, all "APIs" are **synchronous in-process TypeScript module APIs** — there are no HTTP route handlers because authoritative state resides in browser `localStorage`.

### 4.1 Templates API (`src/lib/templates.ts`)
| Function | Signature | Purity | Behavior |
| --- | --- | --- | --- |
| `WORKFLOW_TEMPLATES` | `readonly WorkflowTemplate[]` | Pure constant | Ordered list of the 4 built-in templates (`spec-driven`, `bug-fix`, `prototype`, `content-ops`). |
| `getTemplate` | `(id: string) => WorkflowTemplate \| undefined` | Pure | Resolves template by ID. |
| `firstStageSubstage` | `(template: WorkflowTemplate) => { stageId: string; substageId: string }` | Pure | Returns initial entry coordinates for a new project. |
| `listAllCriteria` | `(template: WorkflowTemplate) => Array<GateCriterion & { stageId: string; substageId: string }>` | Pure | Flattens all criteria with parent coordinates for validation/reporting. |

### 4.2 Gatekeeper API (`src/lib/gatekeeper.ts`)
| Function | Signature | Purity | Behavior |
| --- | --- | --- | --- |
| `askGatekeeper` | `(template: WorkflowTemplate, project: ProjectState, opts?: { stageId?: string; substageId?: string }) => AdvanceVerdict` | Pure | Evaluates target (or current) substage; returns `canAdvance`, partitioned check results, plain-language `summary`, and `nextAction`. Never throws on unknown IDs. |
| `stageProgress` | `(stage: Stage, project: ProjectState) => { total: number; done: number; ready: boolean }` | Pure | Counts `met` + `waived` criteria across a stage and checks if all its substages can advance. |
| `nextSubstage` | `(template: WorkflowTemplate, stageId: string, substageId: string) => { stageId, stageName, substageId, substageName } \| null` | Pure | Computes next sequential substage (rolling over to the next stage's first substage), or `null` at workflow end. |
| `previousSubstage` | `(template: WorkflowTemplate, stageId: string, substageId: string) => { stageId: string; substageId: string } \| null` | Pure | Computes previous sequential substage, or `null` at workflow start. |
| `isStageUnlocked` | `(template: WorkflowTemplate, project: ProjectState, stageId: string) => boolean` | Pure | Returns `true` iff all prior stages' substages satisfy `canAdvance`. |
| `isSubstageUnlocked` | `(template: WorkflowTemplate, project: ProjectState, stageId: string, substageId: string) => boolean` | Pure | Returns `true` iff stage is unlocked and all prior substages in that stage satisfy `canAdvance`. |

### 4.3 Storage Repository API (`src/lib/storage.ts`)
| Function | Signature | Side Effect | Behavior |
| --- | --- | --- | --- |
| `listProjects` | `() => ProjectState[]` | Reads `localStorage` | Returns all saved projects (or `[]` on SSR / empty / corrupt JSON). |
| `getProject` | `(id: string) => ProjectState \| undefined` | Reads `localStorage` | Looks up one project by ID. |
| `getActiveProjectId` / `setActiveProjectId` | `() => string \| null` / `(id: string \| null) => void` | Reads/writes `localStorage` | Tracks the currently open project across reloads. |
| `createProject` | `(input: { name, templateId, harness }) => ProjectState` | Writes `localStorage` | Validates template, initializes coordinates via `firstStageSubstage`, persists, and activates. |
| `updateCriterion` | `(projectId: string, criterionId: string, patch: Partial<CriterionState>) => ProjectState \| undefined` | Writes `localStorage` | Merges criterion patch, stamps `updatedAt` on criterion and project, persists. |
| `advanceProject` | `(projectId: string, next: { stageId, substageId }) => ProjectState \| undefined` | Writes `localStorage` | Updates `currentStageId`/`currentSubstageId` and `updatedAt`, persists. |
| `deleteProject` | `(id: string) => void` | Writes `localStorage` | Removes project and clears active pointer if matched. |

### 4.4 Core Runtime Data Flow
1. **Criterion Update:** User edits status/evidence/note in `CriterionRow` → `AppShell` calls `storage.updateCriterion()` → updated `ProjectState` updates React state → `AppShell` synchronously calls `gatekeeper.askGatekeeper()` and `StageRail` calls `stageProgress()` / `isStageUnlocked()` → `GatekeeperPanel` and `StageRail` re-render with updated verdict and unlocked steps.
2. **Advancement:** When `verdict.canAdvance === true`, user clicks **Advance to next step** → `AppShell` resolves target via `gatekeeper.nextSubstage()` → calls `storage.advanceProject()` → updates viewed and active coordinates.
3. **Backtracking:** User clicks an earlier unlocked substage in `StageRail` → `AppShell` updates `viewStageId`/`viewSubstageId` (without mutating `ProjectState`) → `askGatekeeper` evaluates the viewed substage. If the user resets a required criterion there, `isStageUnlocked` immediately re-locks downstream stages while preserving their saved criteria entries.

### 4.5 Mapping In-Process APIs to Future HTTP/JSON APIs (v2)
When v2 introduces server-side persistence (file store or SQLite) for multi-device use and external Mirevox module integration, Next.js App Router Route Handlers (`src/app/api/**`) become thin HTTP adapters over the unchanged domain modules:

| v1 In-Process Call | Future v2 HTTP Endpoint | Notes |
| --- | --- | --- |
| `WORKFLOW_TEMPLATES` / `getTemplate` | `GET /api/templates`, `GET /api/templates/:id` | Adds optional file/JSON loader for custom templates. |
| `listProjects` / `createProject` | `GET /api/projects`, `POST /api/projects` | Replaces `localStorage` adapter with server repository interface. |
| `updateCriterion` | `PATCH /api/projects/:id/criteria/:criterionId` | Persists criterion evidence/status/note server-side. |
| `askGatekeeper` | `GET /api/projects/:id/gate?stageId=&substageId=` | Calls the exact same pure `askGatekeeper()` function on the server. |
| `advanceProject` | `POST /api/projects/:id/advance` | Server validates `askGatekeeper().canAdvance` and returns `409 Conflict` with `AdvanceVerdict` if blocked. |

---

## 5. Harness Neutrality & Mirevox Control-Plane Composition

### v1 Posture: Labeled Context, Zero Lock-In, Zero Hidden Calls
In v1, `ProjectState.harness` stores a descriptive label (e.g., `"Cursor"`, `"VS Code + side agent"`, `"Local CLI agent"`) and each template supplies a `harnessNote`. No runtime hooks, IDE extensions, vendor SDKs, or LLM clients exist anywhere in the codebase, and user-entered `evidence` URLs are stored as opaque strings and **never** fetched (avoiding SSRF and data leakage). This keeps v1 immediately usable beside *any* tool while remaining epistemically honest: every v1 check outcome is **user-stated** (`met`) or **user-waived** (`waived`), never falsely presented as auto-observed harness telemetry.

### v2 Composition Seams Inside Mirevox
v1 intentionally avoids building speculative plugin frameworks or runtime dependencies on sibling Mirevox modules. Instead, clean data shapes and module boundaries keep v2 integration purely additive:

- **Observed Harness Evidence (v2):** A future harness adapter can ingest concrete external facts (e.g., local test exit code, GitHub check run) and write `CriterionState` records with explicit provenance (`source: "observed"`, adapter name, commit SHA, timestamp) so the UI distinguishes **stated** vs. **waived** vs. **observed** facts honestly.
- **`shadow-versioning`:** Adding an optional `projectId` (e.g., `appcode-xyz-0`) to `ProjectState` lets exported run JSON link milestones to cross-tool timelines without teaching users Git verbs.
- **`context-engine`:** Adding optional `contextRefs` lets future handoff exports attach shared multi-repo context pointers.
- **No LLM Gate in v1:** `gatekeeper.ts` remains a single deterministic pure function with no model client and no speculative `GateEvaluator` AI slot. Any future semantic check belongs in a separate post-v1 module with explicit provenance, never replacing deterministic rule evaluation.

---

## 6. Runtime, Deployment & Docker-Friendly Later Note

### v1 Runtime (Single Host, Zero Ops)
- **Runtime:** Node.js 20+ running Next.js 16.
- **Commands:** `npm install`, `npm run dev` (development) or `npm run build && npm start` (production).
- **Network binding:** Defaults to `127.0.0.1:3847` (loopback-only by default for safe local/VM development).
- **External dependencies:** None. No database, no Redis, no n8n, no reverse proxy, and no homelab stack.

### Docker Compose standup (shipped)
1. **Standalone Next.js output:** `next.config.ts` sets `output: "standalone"`.
2. **Multi-stage `Dockerfile`:** `node:22-alpine` build → non-root `nextjs` runtime; `HOSTNAME=0.0.0.0`, `PORT=3847`; image HEALTHCHECK hits `GET /api/health`.
3. **`docker-compose.yml`:** Single `stage-gate` service, host port via `STAGE_GATE_PORT` (default 3847), no secrets, no volumes (browser `localStorage` remains the store).
4. **`.env.example`:** Documents `STAGE_GATE_PORT` / `PORT` / `HOSTNAME` only — no API keys.
5. **Gap:** Container is intentionally **stateless**; multi-browser/server persistence is a v2 adapter behind `storage.ts`.

---

## 7. Key Architectural Decisions (ADR Summary)

| Decision | Choice Made (v1) | Trade-off Accepted | Revisit Trigger |
| --- | --- | --- | --- |
| **App Framework** | Next.js 16 App Router + TypeScript + Tailwind/Radix | Slight framework weight vs. raw Vite SPA, gained clean path to `/api/*` Route Handlers and `output: "standalone"` Docker builds. | Never for v1; App Router supports v2 server APIs directly. |
| **Gatekeeper Execution** | Pure synchronous TypeScript functions (`gatekeeper.ts`), zero LLM/network clients | Evaluates only saved user-stated/waived fields in v1; no live repo or CI polling. | v2 when adding real observed-fact harness adapters writing provenanced `CriterionState` entries. |
| **Unlock Calculation** | Derived dynamically from prior substages (`isStageUnlocked`) | `O(stages × substages × criteria)` per render (sub-millisecond for `< 100` criteria); eliminates stale unlock flags on backtracking. | Only if templates grow to thousands of criteria (memoize per project revision). |
| **Persistence** | Browser `localStorage` behind `storage.ts` | Single-browser/origin scope, ~5 MB limit, no multi-user sync; achieves zero-DB, zero-setup v1 launch. | v1.1 adds JSON export/import; v2 introduces server-side storage adapter behind the same repository shape. |
| **Harness Integration** | Labeled context (`ProjectState.harness` + `harnessNote`) | `harness_signal` is human-attested in v1 rather than auto-verified. | v2 once core workflow UX and evidence schema are validated with users. |
| **Template System** | 4 built-in declarative templates (`spec-driven`, `bug-fix`, `prototype`, `content-ops`) | No runtime template editor in v1; immediately proves non-spec-locked multi-path value. | v1.1 when users request importing/sharing custom JSON templates. |
