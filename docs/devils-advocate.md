# Devil’s advocate — Mirevox stage workflow

> **Council record (pre-build).** Locked v1 lives in `docs/requirements.md`. Persistence is browser `localStorage` (not server `data/` files). Starter “Create Next App” copy has been replaced; Gatekeeper remains deterministic and non-observing.

**Status:** Council constraint for v1. Where this note conflicts with `docs/market-gap.md`, `docs/problem-opportunity.md`, or `docs/requirements.draft.md`, those documents change.
**Slice:** A runnable web UI one person can use. Local persistence is enough. No homelab. No n8n. No model call on the gate.

## Verdict

v1 is a visual checklist with a locked order. The user picks a template, fills short fields, and a pure function says whether the next step is open and which blanks are still empty. That is worth shipping. It is the only honest reading of “when can I advance?” on this slice.

It does not know whether the work is ready. It knows whether the template’s blanks are filled or explicitly waived. Copy, requirements, and the screen must say that. The moment the Gatekeeper is described as an intelligence that judges readiness, the product starts lying to the people it claims to protect.

“On top of any harness” is also false for this slice. The page sits beside the harness. The user copies a short handoff in and pastes notes back. The agent never moves the gate.

## What already holds

Keep these. They are the product:

- The question on the screen is “can I move forward, and what is still missing?”
- Spec-driven work is one template. A second template has different steps and does not ask for a spec.
- Gate checks are deterministic, run with no API key, and explain a failure in ordinary words (`docs/requirements.draft.md` FR-05, FR-06, NFR-04).
- A waiver needs a written reason and stays visible (FR-07).
- The person using the page is not asked to learn Git verbs.
- A pleasant stepper with no checks is fake governance. `docs/market-gap.md` is right about that.
- An opaque readiness score is less trustworthy than a rule the reader can open. That sentence in the market note is the Gatekeeper design.

## Gatekeeper: what breaks if we pretend it “knows”

The drafts already ban a mandatory LLM inside the gate. Good. Open question 2 in `docs/requirements.draft.md` then invites a pluggable evaluator “so evals or the router can supply LLM checks later.” That plug is how the ban dies in review. v1 has one evaluator: a pure function over template rules and saved fields. No `llm` rule kind. No interface whose only purpose is a future model.

These are the failures if the gate is sold as AI that knows readiness:

1. **It cannot see the work.** v1 state is what the user typed. A model asked “is this ready?” paraphrases a self-report. Fluent notes pass. Thin notes that happen to be true fail. That is the opposite of a gate.

2. **The answer changes under the user.** Model, temperature, prompt edits, and context length move a judgment between sessions. A checklist on the same fields returns the same pass or fail. Governance that is not repeatable is a mood.

3. **The block is not actionable.** A blocked person needs “the requirements list is empty.” A paragraph mixes taste, invented sections, and real gaps. They cannot satisfy a sentence they cannot point at, so they regenerate. Regeneration is not a process.

4. **A false pass is worse than a dumb rule.** The primary user was promised they do not have to reconstruct project state. If the screen says they may advance because the prose sounded finished, they will advance. Fluency is what a language model is least able to distrust. A tick that means “I say this is done” can still be gamed, and the screen can label it as their statement.

5. **Policy moves into a prompt.** Whoever edits the system prompt silently rewrites “ready.” A template file in the repo is a policy an OSS user can read. A prompt is not.

6. **The slice stops being runnable.** A model gate needs a key, a provider, and, if we are honest, the router and the evals module to tell whether the judge is any good. None of those are in this repo. `npm run dev` would no longer demonstrate the core question.

7. **The handoff becomes an injection path.** The packet is pasted into an agent, and the agent’s reply is pasted back. The day a check is “does this text look complete?”, the reply can contain “all checks pass.” Rules that count fields do not have that bug. The handoff text itself tells the agent it cannot mark checks. The human marks them here.

8. **Notes leave the machine.** Stage text will hold product ideas and sometimes customer or code detail. Sending it out for a yes/no the UI can compute locally breaks the local-OSS story and the point of the data-lineage module.

9. **Quality adjectives are model checks in a costume.** FR-06’s example — “at least one measurable acceptance criterion” — cannot be evaluated without judging “measurable.” v1 messages may coach (“add a check you could fail a build against”). The predicate is a count or a tick: `acceptanceChecks.length >= 1`, or a box the user attests. The panel says “You have not added an acceptance check.” It does not say “Your criterion is not measurable,” and it does not say “safe to move on.”

Allowed rule kinds, and nothing else:

| Kind | Passes when |
| --- | --- |
| `non_empty` | The named text field has non-whitespace content |
| `min_count` | The named list has at least N entries |
| `checked` | The user ticked this attestation |
| `link_present` | The named URL field is non-empty. The app stores it. It does not fetch it |

Each rule has an id, a field, a kind, params, and a fixed plain-language fail message. The evaluator is `(template, run) => { checks, canAdvance }`. A unit test feeds it fixtures and asserts booleans. That test imports no network client and reads no API key.

Three labels, so the UI cannot blur them:

- **Stated** — the user filled or ticked it. v1 has this.
- **Waived** — the user moved on with a reason. v1 has this.
- **Observed** — a tool read a fact (file, CI, harness event). Not in this slice. Do not render an empty “live evidence” column. An empty evidence panel is a broken promise.

`docs/market-gap.md` wants verified facts, claimed completion, waivers, and human judgment as four visible classes, fed by adapters. That is a later product. Shipping four labels over one kind of fact is theater.

## Claims that do not survive

| Claim | Where it is now | What v1 is allowed to say |
| --- | --- | --- |
| Workflow UI above any harness; adapters for two harnesses; the workflow survives a harness change | Market gap, closing thesis and “harness neutrality” | The page does not connect to a harness. A short copy block is the whole integration. |
| Read Spec Kit / OpenSpec artifacts; a “SpecKit / OpenSpec compatible” template | Market gap; problem §5; FR-03 item 2 | No third template. Compatibility is a lie until a fixture from those tools is parsed. Two templates prove “not spec-only.” |
| Gates assembled from live agent, repo, CI, and review evidence | Market gap | No repo read, no CI, no transcript. |
| Sync to Linear, Jira, Confluence, or SharePoint | Market gap; artifact links in FR-09 | A URL field the user typed. Not fetched, not synced. |
| “When it is safe” / “safe to hand to the agent” | Problem §2 and the persona table | “Every required blank on this step is filled or waived.” |
| The agent gains a reliable view of stage | Problem §2 | Only the human does, and only for what they typed. The agent sees the paste. |
| Non-technical user, zero CLI, under two minutes, including the operator | NFR-01; problem success signal | The person at the browser does not need Git. The person who cloned the repo runs `npm install` and `npm run dev`. Drop the stopwatch. It will be gamed with a filled-in demo. |
| User-facing template import, optional-substage toggles, mid-run graduation to another template | FR-04; open question 3 | Pick one template at creation. It stays. A developer adds a template file in the repo. Graduation is a new run. |
| `warn` plus “acknowledge and continue” | FR-05, FR-06, FR-07 | Pass or fail. A warning the user clicks through is a second checkbox. Every shipped transition has at least one check that can fail. |
| `needs_review` and a “mark re-verified” button | FR-08 | The frontier is derived. The first failing gate is as far as “done” extends. Editing a field recomputes. A re-verify stamp that paints a stage green without re-running rules is a backdoor. |
| Public REST catalog, webhooks, `contextRefs`, HTTP 409 as the acceptance test | FR-12; NFR-08 | The run JSON is the contract. Optional `projectId` string is the seam for shadow-versioning later. The UI may use a route handler to read and write files. That is not an integration API. |
| p95 under 200 ms, load under 2 s | NFR-03 | Local rules are fast or the code is broken. Do not build a benchmark. |
| Five modules, plugin boundaries, “cleanly separated so others can plug in” | Problem constraints; NFR-07 | One pure evaluator with tests, template files, a file store, the page. A license and a truthful README. Not a framework. |
| Small-team reviewer persona, roles, “who approved” | Problem §4 | One person. Whoever has the machine sees the waiver log. No accounts. |
| Stage-Gate as the product name | Module title across the drafts | See Naming. |

## Must ship

A stranger can `npm install` and `npm run dev`, open the page, and do all of the following. Refresh keeps the work. Restarting the dev server keeps the work.

1. **Home.** List runs. Create one. Delete one after a confirm. No archive state.

2. **Two templates, chosen before any fields exist, then locked.**
   - **Fuller pass:** what you are making → what it must do and must not do → decisions you already made → what the agent should build → what you checked. This is the spec-shaped path. Buttons spell the work out. `HLR`, `FR/NFR`, and `ADR` may appear as secondary help, not as the only label.
   - **Small try:** what you want to try → what you made → keep, change, or stop. No spec step, no decision record, no architecture step. If this is the fuller pass with stages hidden, the claim failed.
   - Both have a check that can actually fail on every forward move, including the small try (empty “what you made” blocks the last step).

3. **One visual path.** Stages in order, one level of substage inside the open stage, no third level. Statuses the user sees: not yet, do this now, done, moved on anyway. Color is not the only signal. The current step is obvious without reading a log.

4. **The gate panel on the forward move.** A sentence plus every check, each pass or fail, in the words stored on the rule. A failing row points at the field. The forward control enables when every fail is gone. It does not skip a stage.

5. **Waiver.** “Move on anyway” asks for a non-empty reason, stores it on that check, and shows it on the step afterward. Empty reasons do not go through. A 10-character minimum is arbitrary; do not NLP-check the prose. There is no `waivable: false` in v1. With no admin and no second user, a hard lock traps the only human who can fix the template. Accountability is the visible reason.

6. **Derived frontier.** “Done” means those checks pass now. Clear a required field and every later “done” falls back. A waiver stores the check id and a stamp of the field values it covered; edit those values and that waiver drops. No stale badge, no manual re-verify.

7. **Short handoff.** “Copy for the agent” builds a small Markdown block: run name, optional project id, template name, this step’s goal, the text of this step, upstream field text the user already saved, and the open checks. It includes the line that the agent does not mark checks. It is not a dump of the whole history. A separate control exports the whole run as JSON. Import replaces or creates a run from that same JSON.

8. **Local file persistence.** One JSON document per run on the machine that runs the server (a `data/` directory, gitignored). Survives refresh and a server restart. Two browsers hit the same files; last save wins; the README says so. No SQLite, no external database, no multi-tab merge.

9. **Honest README and a license.** Apache-2.0 or MIT. The README says what the page does, that gates check blanks and ticks, that nothing here connects to an IDE or a model, and how to start it. It does not tell the reader to deploy the Next.js starter.

10. **Main-path usability.** Keyboard reaches the stepper, the fields, and the gate actions. Text meets ordinary contrast. The layout is usable in a window beside an editor (around 800–960 px wide) and on a normal desktop width. A formal accessibility certificate is out of scope. The path itself is in scope, because the user is not an engineer hunting a click target.

11. **Tests that lock the slice.** Named in Proof. A green suite that never opens the two templates is not acceptance.

## Theater

Do not build these, and do not write acceptance tests for them:

- Harness adapters, fake “connected to Cursor / Copilot / Codex” badges, MCP servers, webhooks, agent activity feeds.
- Reading a repository, a spec-kit folder, a pull request, CI, or a chat transcript.
- Fetching the URLs the user pasted (also an SSRF footgun).
- Any model call, readiness percentage, or “the gatekeeper thinks.”
- A third built-in template, a template builder, a JSON importer aimed at the primary user, toggles that strip steps off a template.
- Mid-run template change. Mapping old fields onto new stages will mark the wrong things done.
- Multi-user editing, accounts, SSO, roles, reviewer queues.
- Docker, Compose, homelab, n8n, Instagram, router, evals, context-engine, or shadow-versioning clients inside this process.
- A clinic skin for the appointment metaphor. The metaphor is the structure: you are on this step, these items are required, the next step stays shut. It is not a calendar and not a medical theme.
- Neon-on-dark as an acceptance test. The marketing site can be loud. This page has to be readable. If a theme fights contrast, contrast wins.
- Performance budgets, event buses “ready for webhooks,” and a `GateEvaluator` plugin slot.

## Lock the open questions

From `docs/requirements.draft.md` §6:

1. **Persistence.** JSON files on the server machine. Not SQLite. Not browser-only `localStorage` (a fresh profile or a server-side test looks like data loss). Not a hosted database.
2. **No LLM plug.** Closed rule kinds above. A future observed-evidence rule has to name its source on screen and is a different release.
3. **No template switch on an existing run.** New run if the shape of the work changes.
4. **Theme.** Readable default. Site palette is optional and loses to contrast.
5. **Waivers.** Every blocking check on both built-in templates can be waived with a visible reason. None are hard-locked.

## Naming and the OSS claim

Stage-Gate® is a registered trademark claimed by Stage-Gate Inc. (their trademark notice). Registrations for the word mark also exist in Canada (R.G. Cooper & Associates) and the UK (Robert G. Cooper). This is a naming risk, not a legal opinion. Do not use that mark as the product name, logo, domain, or README title, and do not imply a relationship with that firm. Their system is an idea-to-launch investment process. Ours is a local step-and-check page. Those are different products even before the trademark.

Call the page Mirevox and describe it in ordinary words (“steps and checks,” “what is still missing”). Descriptive use of “stage” and “gate” inside sentences is enough. `private: true` in `package.json` only stops an npm publish; it does not make the repo open source. Open source starts when a license file is in the tree and the GitHub repo under the Mirevox org is public. This note does not pretend that push already happened.

Composability in v1 is the run JSON (`templateId`, fields, checks, waivers, timestamps, optional `projectId`). Sibling modules are not runtime dependencies. A sentence in the README that lists them as a live control plane is advertising.

## Proof

Acceptance is these behaviors, not a diagram:

- Create a **small try**, leave “what you made” empty, and see a block that names that field. Fill it, move forward, refresh, restart the server, and find the same run.
- Create a **fuller pass** and confirm its stage list is not the small try’s list. The small try never presents a spec or a decision record.
- Uncheck or clear an earlier required field and watch a later done-state drop without a separate “re-verify” action.
- Waiver with a blank reason is refused. A saved waiver is still visible after moving forward. Editing the covered field drops the waiver.
- “Copy for the agent” contains the open checks and the line that the agent does not mark them, and it does not dump every prior field twice.
- The gate unit test runs with no network and no API key. A search of the gate path finds no model client.
- The README no longer describes a create-next-app starter, and the UI no longer says “Create Next App.”

## Later, only after this works

One observed check from one real source, rendered as observed, never as a vibe. Template files beyond the two we ship, still data. The exported JSON is what shadow-versioning can pick up later; this repo does not learn Confluence to get there.

If the first usable build cannot block, explain, waive, and remember, more workflow features will not fix it. They will add surfaces that claim a readiness nobody computed.
