# Market gap: a visual stage-gate layer for AI coding work

## v1 honesty (shipping claim)

**v1 ships today:** a local Next.js UI with four declarative templates, a deterministic Gatekeeper over **user-stated** and **waived** criteria, labeled harness context, and browser `localStorage`. It answers “when can I advance?” for blanks on the current step — not “is the work safe to ship,” and not “what did the agent/CI observe.”

**v1 does not yet:** live harness adapters, repo/CI/PR evidence ingestion, Linear/Jira sync, SpecKit/OpenSpec artifact parsers, or multi-browser server persistence. Those remain the aspirational gap below; do not read them as shipped features.

**Market verdict for this slice:** Yes — a real, narrower gap remains. SpecKit/OpenSpec are CLI/convention workflows without a non-technical visual Gatekeeper; Linear/Jira are delivery systems of record far from the agent loop; enterprise stage-gate suites are heavy; harness UIs are conversation/run-centric and vendor-tied; checklists lack ordered unlock + waiver audit. v1’s honest wedge is **template choice + plain-language advance checks beside any harness**, not cross-harness observed evidence (v2).

---

AI coding products are getting better at doing work, but they still leave users to infer whether the work is ready to move forward. A task may have a plan, a running agent, a diff, passing tests, and unresolved review comments spread across several surfaces. Experienced engineers can reconstruct the state from those signals. A product manager, designer, founder, or operations lead often cannot. The useful question for that user is not “what did the agent say?” but “can this advance, and if not, what is missing?”

Mirevox Stage-gate would occupy that decision layer. Its strongest version is not another agent or a prescribed development method. It is a visual, open-source workflow UI above different coding harnesses, with selectable workflow templates and explicit gates backed by evidence. That positioning matters because the adjacent categories each solve only part of the problem.

## The adjacent market

### SpecKit and OpenSpec

GitHub’s Spec Kit and OpenSpec are the closest conceptual neighbors. Both respond to the weakness of unconstrained “vibe coding” by putting durable artifacts and an ordered process around AI-assisted development. Spec Kit centers a constitution and a sequence such as specify, plan, break into tasks, and implement. OpenSpec similarly makes proposals, specifications, tasks, and archived changes explicit, with a lighter and more iterative posture.

These tools are valuable because they turn intent into repository artifacts that humans and agents can inspect. They also provide a useful source of gate evidence: a spec exists, a plan has been produced, tasks are complete, or a change has been archived. But they are primarily conventions and command-line or prompt-driven workflows. They do not provide a harness-neutral visual control surface for a non-technical stakeholder, and their happy paths remain forms of spec-driven development.

The gap is not “a better SpecKit.” It is a layer that can represent SpecKit or OpenSpec as one template among several. A team should also be able to choose a bug-fix flow, a security remediation flow, a content change, a prototype, or its own governance process without translating everything into a specification lifecycle. Mirevox should therefore integrate with these systems and read their artifacts rather than compete by inventing another incompatible artifact format.

### Linear, Jira, and delivery workflow gates

Linear and Jira are mature systems of record for issues, status, ownership, approvals, and automations. Jira workflows can enforce transitions with conditions, validators, and permissions; marketplace apps add approvals and more elaborate controls. Linear offers a more opinionated issue lifecycle, workflow statuses, project updates, and integrations. Both can model a stage-gate process, and many organizations already use them to do so.

Their weakness in this context is semantic distance from the coding agent. A ticket moving from “In Progress” to “Review” usually records a human action or an automation trigger; it does not necessarily explain whether the agent’s plan was approved, the required repository checks ran, review findings were resolved, or the output satisfies a workflow-specific evidence rule. Connecting those facts is possible, but usually requires custom automation and careful administration. The resulting experience is optimized for engineering delivery management, not for a non-technical person supervising an agent.

Mirevox cannot win merely by showing columns with stricter transition rules. Linear and Jira already do that. Its opportunity is to make each gate an intelligible answer assembled from live agent and repository evidence: what passed, what is absent, what requires a human decision, and what the next action will cause. It should be able to synchronize with an issue tracker rather than demand that the tracker be replaced.

### Enterprise stage-gate and portfolio management software

Enterprise product-development platforms from vendors such as Sopheon, Planview, and Planisware support formal phase reviews, scorecards, approvals, portfolio allocation, and audit trails. They are designed for high-governance product development, often spanning finance, manufacturing, compliance, and executive portfolio decisions. They demonstrate that organizations will pay for explicit gates when the cost of a bad decision is high.

Those products are generally too broad, administratively heavy, and remote from the execution loop of an AI coding harness. Their gates are often portfolio or program events, not rapid checks repeated many times during a software change. They are also proprietary systems intended to become institutional records. Mirevox can be smaller, repository-adjacent, and usable by an individual or small team without a rollout program.

There is still a lesson to take from enterprise tools: a gate is more than a status label. It needs criteria, accountable decisions, evidence, exceptions, and an audit trail. If Mirevox offers only a pleasant stepper, it will capture the appearance of stage-gate without the part that creates trust.

### Cursor and other agent workflow UIs

Cursor, GitHub Copilot’s coding agent, OpenAI’s Codex interfaces, Windsurf, and similar products increasingly expose agent plans, task progress, tool calls, diffs, review, and background execution. These are the products closest to the actual work, and they can improve their native orchestration quickly. Their advantage is privileged access to harness state and a low-friction path from instruction to code.

Most of these interfaces are nevertheless organized around a conversation, task, or agent run. They help a user inspect what an agent is doing, but they do not usually offer a portable, configurable governance model across harnesses. Their workflow is also tied to their own runtime and commercial product. If an organization uses several agents—or changes its preferred one—the process model and history do not travel cleanly.

This creates the most credible opening for Mirevox: retain the workflow, gates, evidence vocabulary, and human decisions while execution can move between harnesses. It also creates the largest competitive risk. Native agent products can add approval steps, plan review, test requirements, and team dashboards. Mirevox therefore needs to be meaningfully cross-harness and workflow-aware; being a generic skin over one agent’s task API would be easy to absorb.

### Checklist and no-code workflow tools

Process Street, Pipefy, Trello, Notion, GitHub issue templates, and ordinary checklists can all represent repeatable steps. They are approachable, flexible, and often already available. No-code automation products can require approvals and connect events between systems. For teams with low execution volume, a checklist beside an agent may be good enough.

What these tools generally lack is a reliable connection between a checked box and the underlying coding evidence. “Tests pass” can be manually checked even when the latest commit has not been tested. “Review complete” can conceal unresolved comments. Generic workflow tools also do not understand agent sessions, repository state, generated plans, diffs, CI checks, or the distinction between an automated criterion and a human approval.

Mirevox’s differentiation must therefore be evidence-backed gates, not digital checkboxes. Manual checks are still useful, but the UI should clearly distinguish verified facts, claimed completion, waived criteria, and pending human judgment.

## The gap worth filling

The market has agent execution surfaces, specification methods, issue trackers, formal governance suites, and flexible checklists. What is still poorly served is a lightweight control plane that combines four properties:

1. **Harness neutrality.** The process is not owned by Cursor, Copilot, Codex, or another runtime. Adapters translate each harness’s events into a stable workflow model.
2. **Template choice.** Spec-driven development is supported without becoming mandatory. Templates can encode different levels of rigor for different kinds of work.
3. **Evidence-backed advancement.** A gate states which criteria are satisfied, where the evidence came from, which facts may be stale, and who can approve or waive the rest.
4. **A non-technical explanation.** The primary output is a plain answer to “when can I advance?” with specific blockers and consequences, not a stream of tools, tokens, or terminal logs.

That combination is narrower than project management and broader than one agent session. It fits Mirevox’s modular control-plane direction: execution remains replaceable, while workflow policy and human oversight become shared modules.

## Why open source, and why now

The timing is favorable because agent execution is fragmenting faster than workflow conventions are stabilizing. Teams are experimenting with several local, IDE, cloud, and CI-based harnesses. An open adapter layer can meet those systems where they are and reduce the fear that adopting a workflow UI also commits the team to one model vendor or agent runtime.

Open source is especially relevant for a governance layer. Gates may encode internal policy, and the evidence can include source code, security findings, and approval history. Teams need to inspect how a decision was reached, run the software near their repositories, and extend it for private tools. A transparent gate evaluator is more credible than an opaque readiness score. Templates and adapters also have plausible community value: users can share a workflow without sharing their code.

“Now” does not mean the category is guaranteed. It means the underlying primitives are finally common enough—agent runs, repository artifacts, CI statuses, review events, and tool protocols—to build a useful normalization layer, while no single harness has yet established a universal workflow model. Shipping as OSS can test whether portability and explicit gates are a real need before Mirevox builds a large proprietary platform around the assumption.

## Risks and the standard for differentiation

The central risk is that this is perceived as a thin workflow wrapper. If users can reproduce the experience with a Jira board, a repository template, and two automations, they may prefer tools they already operate. A polished diagram does not solve that problem. The product must reduce the work of determining readiness, not add another place to update status.

Harness neutrality is also expensive. Agent products expose different concepts and APIs, and those APIs will change. Some important state may be inaccessible or too loosely structured to verify. Mirevox should describe support honestly as adapter-specific capabilities, not claim identical control over every harness. A stable internal event and evidence model, graceful handling of unknown state, and visible provenance are core product work.

There is a tension between rigor and speed. Formal gates can make AI-assisted development safer, but they can also recreate heavyweight process around work whose appeal is rapid iteration. Templates need sensible levels of ceremony, and users should be able to see why a criterion exists, bypass it with an explicit record when policy permits, and remove gates that do not earn their cost.

The “non-technical user” promise also needs care. Simplifying the display cannot make uncertain technical evidence certain. A gatekeeper should say “the configured tests passed on commit X, but no security scan is configured,” not “safe to ship.” False confidence would be worse than the fragmented status quo.

Finally, incumbent responses are plausible. Coding harnesses can add native gates; issue trackers can deepen agent integrations; SpecKit or OpenSpec ecosystems can grow visual UIs. Mirevox’s defensible contribution is therefore unlikely to be any single screen or template. It is the combination of an open evidence schema, useful cross-harness adapters, portable workflow definitions, and a clear decision experience. If the first release does not demonstrate at least two materially different harnesses and two materially different workflow templates, the neutrality claim will remain theoretical and the product will look like another opinionated checklist.

The practical shipping thesis for **v1** is more modest than the long-term gap: prove that selectable templates + a deterministic Gatekeeper over stated/waived checks let a non-technical stakeholder see remaining blockers without reading an agent transcript, while sitting beside (not inside) any harness. Surviving a harness change with **observed** evidence and adapters is the v2 bar. If users do not value even the v1 decision surface, more workflow features will not create the missing differentiation.

## Top alternatives (snapshot)

### OSS
| Product | Role | Gap vs Stage-gate v1 |
| --- | --- | --- |
| [GitHub Spec Kit](https://github.com/github/spec-kit) | Spec/plan/tasks/implement (also documents bug-fix & idea paths) | Agent/CLI/repo-centered; not a persistent visual Gatekeeper for non-technical users |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | Proposals, delta specs, tasks across many assistants | Fluid “enablers not gates”; chat/repo workflow, not nested stage unlock UI |
| [BMad Method](https://github.com/bmad-code-org/BMAD-METHOD) | Adaptive AI method (clarify → plan → implement; skip planning for small fixes) | Strongest challenge to “selectable rigor”; still developer/command-oriented |
| [Plane CE](https://plane.so/open-source) | Self-hosted visual PM (states, cycles, docs) | Broader multi-user PM; OSS lacks approval gates (paid add-on) |

### Paid / commercial
| Product | Role | Gap vs Stage-gate v1 |
| --- | --- | --- |
| [Jira](https://www.atlassian.com/software/jira) | Configurable workflows, validators, approvals | Can reproduce most v1 behavior with admin cost; issue-centric, not agent-sidecar |
| [Linear](https://linear.app) | Issue/project lifecycle + delivery integrations | Light delivery SoR; not criterion-level readiness + waivers |
| [Process Street](https://www.process.st/) | Visual workflows, stop tasks, approvals | Closest generic UX substitute; proprietary, not coding-template specific |
| [Cursor](https://cursor.com) Plan / Cloud Agent | Native plans, runs, PR artifacts | Real execution evidence; one-harness lock-in, no portable stage templates |

**Note:** Generic checklists also lack live coding evidence — and **so does Stage-gate v1**. Differentiation today is local OSS packaging + software-oriented templates + ordered unlock + reason-required waivers, not observed evidence.
