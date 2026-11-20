# Mirevox Stage-gate — Problem & Opportunity

**Umbrella:** Mirevox (`https://github.com/Mirevox`) — a faceless open-source charity umbrella of modular agent control-plane components.  
**Module:** `stage-gate` — harness-agnostic visual stage-gate workflow and Gatekeeper UI.  
**Status:** Draft (Requirements Gatherer output; ready for council vetting).

---

## 1. Context: Where Stage-gate Sits

Modern AI coding and work tools run inside a **harness** — the workspace around a model that manages tools, files, sandboxes, retries, and execution (for example, VS Code with a side agent, a terminal coding agent, or a web chat workspace). Harnesses are good at executing tasks once instructions are clear, and poor at guiding a human through *what should happen before execution* and *when it is safe to move to the next phase*.

Mirevox builds modular control-plane components that sit *above* models and harnesses rather than competing with foundation models or building yet another terminal harness. **Stage-gate** is the human-facing workflow layer in that control plane: an open-source, runnable web UI that guides people through structured delivery stages and substages on top of whichever harness they already use.

---

## 2. The Problem

When people — especially non-technical product owners, analysts, or domain experts — try to build software or operational tools with an AI agent harness, four failure modes show up repeatedly:

1. **Flat chat hides project state.**  
   Multi-day work gets buried inside long chat transcripts and scattered Markdown files. After twenty messages, neither the human nor the agent has a reliable view of what is settled, what is still a guess, and what stage the work is actually in.

2. **No clear answer to "when do I advance?"**  
   Agents readily jump straight into writing code from a two-sentence prompt. Conversely, cautious users stall because they do not know when pre-requirements are solid enough to draft functional and non-functional requirements, when requirements justify an architecture decision record (ADR), or when a spec is complete enough to build against. Without explicit transition checks, work either rushes forward prematurely or stalls in ambiguity.

3. **Methodology lock-in.**  
   Most workflow overlays assume one fixed way of working — either completely unstructured prompting or rigid spec-driven development (such as SpecKit or OpenSpec as the only allowed path). Real work is not uniform. A high-stakes production feature benefits from `HLR → FR/NFR → ADR → Spec → Build → Verify`, while an exploratory spike or internal prototype needs a shorter build-and-review loop without heavy paperwork.

4. **Tooling literacy blocks non-technical users.**  
   Driving an agent harness today often assumes comfort with CLI invocations, Git branching, repository conventions, and prompt choreography. Non-technical users who understand the domain problem well cannot reliably steer an agent through a disciplined lifecycle without an approachable visual layer.

---

## 3. The Opportunity

Stage-gate addresses these gaps by bringing a familiar consumer interaction pattern to agent-assisted delivery:

- **The appointment-booking metaphor applied to SDLC.**  
  Nearly everyone has used a multi-step booking flow: pick a service, choose a slot, fill required details, review, confirm. At every moment you can see the high-level stages, the substeps inside the active stage, which items are complete, and exactly what is missing before the next button unlocks. Applying that same visual structure to software and workflow delivery (`Pre-requirements → Requirements → Build / Spec-or-Alternative → Verification / Release`) makes complex multi-stage work immediately legible to non-technical users.

- **Selectable templates instead of one dogma.**  
  Stage-gate treats methodology as data. Spec-driven workflows (SpecKit, OpenSpec, or a full `HLR → FR/NFR → ADR → Spec` progression) are first-class selectable templates, alongside lighter build-first, spike/prototype, and decision-memo tracks. Users choose the rigor that fits the task instead of bending every task to one framework.

- **Explicit, human-readable Gatekeeper checks.**  
  Every stage and substage can define concrete readiness checks that answer "can I advance yet, and if not, why?" Checks explain missing evidence in plain English, point directly to the incomplete substep, and allow deliberate overrides with a recorded reason so teams keep momentum without losing accountability.

- **Harness-agnostic and open source.**  
  Stage-gate does not trap users inside a proprietary IDE, model provider, or agent runtime. At any substage, users can generate a clean handoff packet (context, approved prior artifacts, current goal, and active gate criteria) to paste or feed into VS Code with a side agent, a CLI harness, or another tool.

- **Composable inside the Mirevox control plane.**  
  Stage-gate is useful completely standalone on a single machine, while exposing clean identifiers and boundaries (such as an optional project ID like `appcode-xyz-0`) so it pairs naturally with sibling Mirevox modules over time:
  - `shadow-versioning` — unified version timeline across Confluence, SharePoint, Git, and tests without forcing non-technical humans to learn Git verbs.
  - `context-engine` — shared multi-repo context so agents do not re-index codebases from scratch at every stage.
  - `smart-router` and `evals` — optional automated evaluation or model-assisted checks when teams want them later.
  - `data-lineage` — tracing where data moves once connected through the control plane.

---

## 4. Target Users

| Persona | Profile | Primary Need from Stage-gate |
| --- | --- | --- |
| **Non-technical Domain Lead / Product Owner** *(primary)* | Understands business rules and user needs; uses VS Code + a side agent or chat harness to build or shape a tool, but does not live in Git or terminal workflows. | A calm, plain-English visual guide showing what stage they are in, what to prepare next, and when it is safe to hand work to the agent. |
| **Solo Builder / Technical Generalist** | Comfortable with coding harnesses, but wants repeatable discipline across projects of varying risk. | Fast template selection (strict `HLR → FR/NFR → ADR → Spec` for core work; lean prototype flow for spikes) and explicit gate checks to avoid skipping critical thinking. |
| **Small Team / Reviewer** | Collaborators reviewing whether an agent-assisted change is ready to move from design to build or release. | Inspectable stage history, captured artifacts, pass/fail gate status, and a clear log of any waived checks. |
| **Open-Source / Mirevox Integrator** | Adopts or extends Mirevox modules for an internal workflow or local control plane. | Clean schemas, template definitions as plain files/JSON, and predictable API boundaries for composing with `shadow-versioning`, `context-engine`, or custom harnesses. |

---

## 5. v1 Ship Slice

To prove the concept quickly without overbuilding infrastructure, **v1** targets a focused, runnable slice on a single Cloud VM:

1. **Runnable web UI** displaying visual stages and nested substages using the appointment-booking stepper model, usable side-by-side with VS Code or in a full browser window.
2. **Selectable workflow templates** shipped out of the box — explicitly *not* spec-only (for example: Structured SDLC `HLR → FR/NFR → ADR → Spec`, a SpecKit/OpenSpec-compatible track, and a Rapid Build / Prototype track) plus support for customizing or adding templates.
3. **Working Gatekeeper checks** evaluating "when can I advance?" at each stage/substage, displaying clear pass / needs-attention / blocking feedback, direct pointers to missing items, and audited human overrides where allowed.
4. **Plain-language UX and harness handoff** allowing a non-technical user to capture stage artifacts in the UI and copy or export a structured handoff packet for VS Code + side agent (or any other harness).
5. **Local persistence and portability** on a single Cloud VM, with clean data schemas ready for later Docker packaging and Mirevox module integration.

**v1 Success Signal:** A non-technical user can start a new workflow run, pick a template suited to their task, progress through pre-requirements into requirements and a build or spec track, understand exactly why a gate holds or passes, export a usable handoff for their agent harness, and resume after a restart — without touching Git commands, source code, or terminal-only tooling.

---

## 6. Constraints & Non-Goals

### Constraints
- **Cloud VM runtime for now:** Must run cleanly on a single Linux Cloud VM with minimal setup.
- **No full homelab dependency:** Do not require spinning up a homelab stack, multi-service cluster, or heavy orchestration infrastructure.
- **Docker later, not a blocker:** Keep the app layout and state boundaries Docker-friendly for later packaging, without blocking the v1 runnable slice on container orchestration.
- **No n8n or Instagram/content pipeline:** Out of scope.
- **Composable by design:** Keep workflow engine, Gatekeeper, storage, and UI cleanly separated so other Mirevox modules can plug in without rewrites.

### Explicit Non-Goals (v1)
- **Not a foundation model or new agent harness:** Stage-gate sits above existing harnesses; it does not replace VS Code, Claude Code, Cursor, or terminal agents, nor does it execute arbitrary shell sandboxes.
- **Not locked to SpecKit, OpenSpec, or spec-driven development:** Spec-driven tracks are selectable options, never mandatory.
- **Not a Git UI:** Users must never be forced to learn branches, commits, rebases, or pull requests to move through stages (versioning across external tools belongs in `shadow-versioning`).
- **Not an enterprise compliance or Terraform spin-up portal:** No enterprise SSO/RBAC matrix, multi-tenant billing, or cloud infrastructure provisioning in v1.
- **No mandatory live LLM API keys:** Core v1 navigation, artifact capture, template selection, deterministic Gatekeeper checks, and harness handoff must work out of the box without requiring paid model credentials.
