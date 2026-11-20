# Mirevox Stage-gate — Draft Requirements (v1)

**Umbrella:** Mirevox (`https://github.com/Mirevox`)  
**Module:** `stage-gate`  
**Status:** Draft for council review (Requirements Vetter, Architect, FR/NFR Author, Market Researcher, Devil's Advocate). Final locked requirements will live in `docs/requirements.md`.

---

## 1. Scope & Purpose

This document defines the draft functional requirements (FRs), non-functional requirements (NFRs), acceptance criteria, and non-goals for **Mirevox Stage-gate v1**: a runnable web application on a single Cloud VM that provides a visual stage-and-substage workflow stepper, selectable non-locked workflow templates, and a Gatekeeper ("when can I advance?") engine designed for non-technical users operating on top of any agent harness (such as VS Code + a side agent).

---

## 2. Core Domain Concepts

| Term | Definition |
| --- | --- |
| **Workflow Run** | A single tracked initiative (for example, building a small internal tool or scoping a feature). Holds a selected template, stage states, captured artifacts, gate evaluations, waiver history, and optional external identifiers (such as `projectId: "appcode-xyz-0"`). |
| **Workflow Template** | A named, reusable blueprint defining stages, substages, expected artifacts, guidance prompts, and Gatekeeper rules. Stored as declarative data (JSON/YAML), not hardcoded UI branches. |
| **Stage** | A top-level lifecycle phase visible on the main stepper (for example: *Pre-requirements*, *Requirements*, *Design / Build Path*, *Verification*, *Handoff*). |
| **Substage** | A concrete step inside a stage (for example, inside *Requirements*: *High-Level Requirements (HLR)* → *Functional & Non-Functional Requirements (FR/NFR)* → *Scope & Non-Goals Check*). |
| **Artifact** | User-authored or pasted evidence attached to a substage — structured form fields, Markdown notes, checklists, or external links (for example: Problem Brief, HLR, FR/NFR, ADR, Spec, Prototype Notes, Test Summary). |
| **Gate & Gatekeeper Check** | A rule evaluated against a substage or stage to determine readiness to advance. Each check produces one of three states: `pass`, `warn` (needs attention), or `block` (cannot advance unless resolved or explicitly waived where permitted). |
| **Harness Handoff Packet** | A portable Markdown or JSON bundle assembled from the current stage/substage goal, approved upstream artifacts, and active gate criteria, ready to paste or pass into VS Code + a side agent or any other harness. |

---

## 3. Functional Requirements (Draft)

### A. Visual Stage & Substage Navigation

#### FR-01: Visual Stage-and-Substage Stepper (Appointment-Booking Metaphor)
The UI shall display the full workflow as an ordered visual progression of stages and nested substages so the user can tell at a glance where they are, what is completed, what is active, and what comes next.

**Acceptance Criteria:**
- Opening a workflow run displays all top-level stages in order with clear status indicators (`completed`, `in_progress`, `blocked`, `not_started`, `needs_review`).
- Selecting or focusing a stage expands or highlights its ordered substages with individual completion and gate indicators.
- A user can see overall progress (for example, completed substages / total substages and current active stage) without scrolling through raw logs or files.
- Navigating between completed or unlocked stages preserves unsaved or auto-saved progress without losing data.

#### FR-02: Plain-Language Substage Workspace
Each substage shall present a guided, jargon-free workspace explaining what the step accomplishes, what input or artifact is needed, and what happens after it is complete.

**Acceptance Criteria:**
- Every built-in substage displays a plain-English title, a short "Why this step matters" summary, and clear prompts/fields for expected inputs.
- Technical abbreviations (such as `HLR`, `FR/NFR`, `ADR`, `Spec`) include inline plain-English explanations or hover/expandable help so a non-technical user understands them without outside lookup.
- The workspace clearly separates *current step work* from *Gatekeeper readiness status* and *next-step action*.

---

### B. Selectable & Extensible Workflow Templates (Not Spec-Locked)

#### FR-03: Built-in Multi-Path Workflow Templates
The system shall ship with at least three distinct built-in workflow templates demonstrating that spec-driven development is an option rather than the only path:
1. **Structured SDLC (`HLR → FR/NFR → ADR → Spec`)**: Pre-requirements (Problem & Users) → Requirements (HLR → FR/NFR) → Architecture & Spec (ADR → Technical Spec) → Build → Verify & Handoff.
2. **Spec-Driven Track (SpecKit / OpenSpec Compatible)**: Pre-requirements → Constitution / Principles → Specification → Plan & Tasks → Implement → Verify — allowing teams using SpecKit or OpenSpec conventions to run them inside Stage-gate.
3. **Rapid Build / Prototype Track (Non-Spec Path)**: Pre-requirements (Goal & Constraints) → Direct Build / Spike (Working Prototype + Notes) → User Check & Decision (Keep, Iterate, or Graduate to Structured Track) — explicitly skipping formal specs and ADRs.

**Acceptance Criteria:**
- When creating a new workflow run, the user can compare available templates side by side (name, best-fit description, stage count, and preview of stages/substages) before choosing one.
- Selecting the Rapid Build / Prototype template lets a user progress from pre-requirements directly to build and review without ever being forced to author a formal spec or ADR.
- Selecting the Structured SDLC template enforces the explicit `HLR → FR/NFR → ADR → Spec` progression with corresponding substages and gate checks.
- Selecting the Spec-Driven Track surfaces SpecKit/OpenSpec-friendly artifact slots and handoff phrasing.

#### FR-04: Template Customization & Declarative Import/Export
Users shall be able to adjust optional substages for a run and load or export custom workflow templates without modifying application source code.

**Acceptance Criteria:**
- Built-in templates are stored as declarative definitions (JSON or YAML) conforming to a documented schema, rather than hardcoded conditional UI views.
- Users can toggle optional substages on or off when configuring a run (with required core substages clearly marked).
- Users can import a valid custom template file (JSON) and immediately create a new run using it; invalid templates are rejected with clear, human-readable validation errors pointing to the malformed field.
- Users can export any existing template as JSON to share or version externally.

---

### C. Gatekeeper ("When Do I Advance?")

#### FR-05: Deterministic Stage & Substage Gate Evaluation
The Gatekeeper shall evaluate explicit readiness checks before advancing from a substage or stage to the next, including artifact presence, required section/field completion, checklist confirmation, and upstream dependency checks (for example, confirming HLR exists before advancing to FR/NFR, and FR/NFR + ADR exist before advancing to Spec on the Structured template).

**Acceptance Criteria:**
- Each stage and substage defines zero or more declarative gate checks with severity (`block` or `warn`).
- Gate status updates automatically whenever the user edits an artifact, toggles a checklist item, or updates an upstream stage.
- Attempting to advance past a stage with an unresolved `block` check prevents silent advancement and opens or highlights the Gatekeeper panel explaining why.
- All built-in templates include meaningful, non-trivial gate checks on every stage transition.

#### FR-06: Actionable "Why Can't I Advance?" Feedback
When a gate is not ready, the UI shall clearly communicate every passing, warning, and blocking criterion along with concrete instructions to resolve it.

**Acceptance Criteria:**
- The Gatekeeper panel lists every check for the current transition with an unmistakable status (`Pass`, `Needs Attention`, or `Blocking`).
- Each failing or warning check includes a plain-English explanation of what is missing (for example, *"Add at least one measurable acceptance criterion in Functional Requirements before advancing to ADR"*).
- Clicking a failing check focuses or navigates directly to the relevant substage or input field.
- When all blocking checks pass, the primary "Advance to [Next Stage]" action becomes clearly enabled and summarizes any remaining non-blocking warnings.

#### FR-07: Controlled Override / Waiver with Audit Trail
To avoid trapping users in rigid bureaucracy, the Gatekeeper shall support advancing past warnings and — when permitted by the template — explicitly waiving a blocking check with a recorded reason.

**Acceptance Criteria:**
- Users can advance past `warn` checks after acknowledging them.
- For `block` checks marked `waivable: true` in the template, the user can click "Override Gate" and must enter a non-empty reason (minimum 10 characters) before advancing.
- Non-waivable hard gates (if configured with `waivable: false`) clearly explain that override is disabled by the template.
- Every override is recorded in the run's timeline with timestamp, stage/substage name, waived check ID, and user-provided reason, and remains visually flagged on the stage indicator.

#### FR-08: Backtracking & Downstream Staleness Detection
Users shall be able to return to an earlier completed stage to revise decisions or artifacts, and the system shall warn when downstream stages may now be out of sync.

**Acceptance Criteria:**
- Users can reopen and edit any previously completed stage or substage.
- Saving a material edit to an upstream artifact marks dependent downstream stages as `needs_review` (stale) rather than silently keeping them green.
- The user can inspect which upstream artifact changed and explicitly mark a downstream stage re-verified once reviewed or updated.

---

### D. Artifacts, Harness Handoff & Persistence

#### FR-09: Structured Artifact Capture per Substage
Each substage shall allow capturing artifacts directly in the web UI using guided inputs (structured prompts, Markdown text, checklists, and optional external links).

**Acceptance Criteria:**
- Users can create, edit, and save artifacts attached to each substage (for example: Problem Statement, HLR list, FR/NFR items with acceptance criteria, ADR decision/options/trade-offs, Spec summary, Prototype notes, Verification checklist).
- Users can attach external reference links (for example, a PR URL, Confluence page, SharePoint doc, or repo path) to any substage without uploading binary files.
- Artifacts render cleanly as readable Markdown or structured cards and can be copied individually.

#### FR-10: Harness-Agnostic Handoff Packet
At any substage, the user shall be able to generate a ready-to-use handoff packet for an external agent harness (such as VS Code + side agent, terminal coding agent, or chat agent).

**Acceptance Criteria:**
- Every active substage provides a "Copy Handoff for Agent" action and a downloadable Markdown (`.md`) / JSON (`.json`) export.
- The generated handoff packet includes: workflow name, optional project ID, selected template, current stage and substage goal, approved upstream artifacts (or selected summary), active Gatekeeper criteria that the agent's output must satisfy, and a plain-English instruction block ready to paste into a side agent.
- The user can paste an agent's output back into the substage artifact box and immediately see Gatekeeper checks re-evaluate against the updated content.

#### FR-11: Local Persistence & Portable Run Export/Import
Workflow runs and their full state shall persist reliably on the Cloud VM and be portable across machines.

**Acceptance Criteria:**
- Creating runs, editing artifacts, advancing stages, and recording gate waivers persist across browser refreshes and application server restarts on the Cloud VM.
- Users can view a list of existing workflow runs on a dashboard/home view, resume any run, or delete/archive a run.
- Any workflow run can be exported as a single portable JSON file (and human-readable Markdown summary) and re-imported cleanly into another Stage-gate instance.

---

### E. Mirevox Control-Plane Composability

#### FR-12: Composable Project Metadata & API Surface
Stage-gate shall expose clean metadata fields and HTTP/JSON endpoints so other Mirevox modules can integrate without coupling into UI internals.

**Acceptance Criteria:**
- Every workflow run supports an optional external `projectId` (for example, `appcode-xyz-0` for pairing with `shadow-versioning`) and optional `contextRefs` (for example, repo URLs or `context-engine` corpus IDs).
- A documented local REST/JSON API exposes read/write access to templates, runs, stage state, artifacts, and Gatekeeper evaluations (for example: `GET/POST /api/runs`, `GET /api/runs/:id/gate`, `POST /api/runs/:id/advance`, `GET /api/templates`).
- Stage transitions and gate events emit a clean structured event record stored on the run (ready to forward as webhooks or control-plane events in future versions without breaking the v1 schema).

---

## 4. Non-Functional Requirements (Draft)

| ID | Category | Requirement | Measurable Acceptance Criterion |
| --- | --- | --- | --- |
| **NFR-01** | Usability (Non-Technical) | Natural, plain-English UX with zero Git or CLI prerequisites. | A first-time non-technical user can create a run, pick a template, complete a pre-requirements substage, inspect a blocking gate, and copy a harness handoff packet in under 2 minutes using only the web UI; zero Git terms (`commit`, `branch`, `rebase`, `diff`) are required in user-facing flows. |
| **NFR-02** | Deployability & Footprint | Single Cloud VM runnable without homelab or cluster dependencies. | App installs and starts cleanly on a single Linux Cloud VM using standard runtime commands (`npm install && npm run dev` or `npm run build && npm start`) with local file/embedded storage; no Docker Swarm, Kubernetes, external DB server, or homelab stack required in v1. Directory layout and config via env vars keep future Dockerization straightforward. |
| **NFR-03** | Responsiveness | Fast interactive stepper and instant Gatekeeper feedback. | Switching stages/substages and evaluating local Gatekeeper rules complete in `< 200 ms` (p95) for runs with up to 50 artifacts; initial web app load completes in `< 2 s` on local/Cloud VM network. |
| **NFR-04** | Harness & Model Neutrality | Zero lock-in to any LLM provider, IDE, or spec toolkit. | 100% of v1 functional requirements pass with no external LLM API keys configured and without any specific IDE extension installed. |
| **NFR-05** | Data Portability | Human-readable, inspectable open formats. | Templates and exported workflow runs use documented JSON and Markdown schemas; no proprietary binary formats are required to read or back up user work. |
| **NFR-06** | Accessibility & Side-by-Side Layout | Usable next to an IDE (such as VS Code) and accessible via keyboard. | Stepper navigation, artifact inputs, and Gatekeeper checklists are keyboard-accessible (`Tab`, `Enter`, `Escape`), meet WCAG AA text contrast, and remain usable at both desktop (`1440px`) and narrow split-screen widths (`768px`–`960px`) beside an IDE. |
| **NFR-07** | Modularity & Open-Source Hygiene | Clean internal boundaries and open-source readiness. | Core workflow engine, declarative template loader, Gatekeeper evaluator, persistence adapter, and web UI live in distinct modules with unit tests; repository includes an open-source license (Apache-2.0 or MIT) and a README explaining standalone startup and Mirevox composition. |
| **NFR-08** | Reliability & State Integrity | Safe transitions and no silent data loss. | Invalid API transitions (such as skipping a blocked non-waived gate) return HTTP `409 Conflict` with structured failing-check details; automated test suite verifies template validation, gate evaluation, override logging, backtracking staleness, and persistence round-trips. |

---

## 5. Non-Goals (v1)

The following are explicitly out of scope for v1 and should not expand build scope:
- Building an agent runtime, shell execution sandbox, or replacement for VS Code / terminal harnesses.
- Live multi-user real-time collaborative editing (CRDTs/WebSockets) or enterprise SSO/RBAC.
- Mandatory live LLM calls inside the Gatekeeper (semantic AI-assisted gate checks via `smart-router` or `evals` may be added as an optional plugin after v1).
- Direct Git write operations or Git-first UI workflows (`shadow-versioning` handles cross-tool version timelines).
- Full homelab deployment, n8n workflows, or Instagram/content automation.
- Cloud infrastructure provisioning or hyperscaler compliance portals.

---

## 6. Open Questions for Council Review

These items are intentionally left open in the draft for the Requirements Vetter, Architect, Market Researcher, and Devil's Advocate to challenge and lock before `docs/requirements.md`:

1. **Persistence backend for v1:** Should v1 store runs/templates in structured local JSON files on disk (maximally transparent, zero native binaries) or embedded SQLite (stronger query/concurrency semantics)?
2. **Gate check depth in v1:** Deterministic checks (required fields, minimum item counts, checklist ticks, linked upstream IDs, regex/section headings) guarantee offline speed and zero API-key friction. Should v1 also define a pluggable `GateEvaluator` interface so `evals` / `smart-router` can later supply optional LLM-backed checks without changing template schemas?
3. **Template switching mid-run:** Should a user who starts on *Rapid Build / Prototype* be able to "graduate" a run into *Structured SDLC* mid-flight, or is starting a linked follow-up run sufficient for v1?
4. **Visual theme alignment:** Mirevox's showcase website uses a dark theme with purple and neon-blue accents. Should Stage-gate's v1 UI default to that dark theme (or offer light/dark toggle) while prioritizing calm, high-legibility UX for non-technical users?
5. **Default waiver policy:** On the *Structured SDLC* template, which gates (if any) should default to `waivable: false` versus `waivable: true` with mandatory rationale?
