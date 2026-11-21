import type { WorkflowTemplate } from "./types";

/** Built-in workflow templates — Spec-driven is one option, not the only path. */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "spec-driven",
    name: "Spec-driven build",
    tagline: "Clarify → decide → specify → build, with clear gates between each.",
    audience: "Teams who want a written agreement before agents write a lot of code.",
    harnessNote: "Works with VS Code + side agent, Cursor, SpecKit/OpenSpec-style flows, or any chat harness.",
    stages: [
      {
        id: "pre-req",
        name: "Pre-requirements",
        summary: "Frame the problem before writing requirements.",
        substages: [
          {
            id: "problem",
            name: "Problem frame",
            summary: "Who hurts, what happens today, and what success looks like.",
            criteria: [
              {
                id: "problem-who",
                label: "Who this is for is written down",
                help: "Name the people who will use or benefit from the change.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Add a short note naming the users or stakeholders.",
              },
              {
                id: "problem-pain",
                label: "Current pain is described",
                help: "One or two sentences on what goes wrong today.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Describe the pain in plain language (a paragraph is enough).",
              },
              {
                id: "problem-success",
                label: "Success picture agreed",
                help: "What “done and good” looks like for this slice.",
                kind: "checklist",
                required: true,
                howToSatisfy: "Write a success picture and mark it checked when the team agrees.",
              },
            ],
          },
          {
            id: "hlr",
            name: "High-level requirements",
            summary: "Capture the big capabilities without diving into detail.",
            criteria: [
              {
                id: "hlr-list",
                label: "High-level requirements listed",
                help: "A short list of capabilities, not full specs yet.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Save an HLR list (bullet points are fine).",
              },
              {
                id: "hlr-out",
                label: "Out of scope called out",
                help: "What this slice will not do.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Add an explicit “not in this slice” section.",
              },
            ],
          },
        ],
      },
      {
        id: "requirements",
        name: "Requirements",
        summary: "Turn high-level intent into FR/NFR the team can test.",
        substages: [
          {
            id: "fr-nfr",
            name: "FR / NFR",
            summary: "Functional and non-functional requirements with exits.",
            criteria: [
              {
                id: "fr-written",
                label: "Functional requirements written",
                help: "What the system must do, with measurable acceptance.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Attach or paste FRs with acceptance criteria.",
              },
              {
                id: "nfr-written",
                label: "Non-functional requirements written",
                help: "Quality bars: performance, security, accessibility, ops.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Attach or paste NFRs with measurable exits.",
              },
              {
                id: "req-review",
                label: "Someone reviewed the requirements",
                help: "A second pair of eyes — not necessarily an engineer.",
                kind: "approval",
                required: true,
                howToSatisfy: "Have a reviewer mark this approved (or waive with a reason).",
              },
            ],
          },
          {
            id: "adr",
            name: "Architecture decisions",
            summary: "Record the few choices that would be expensive to reverse.",
            criteria: [
              {
                id: "adr-recorded",
                label: "Key decisions recorded (ADR)",
                help: "Not every choice — just the ones that lock the shape.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Save one or more ADRs (or a short decision note).",
              },
            ],
          },
        ],
      },
      {
        id: "spec",
        name: "Spec or plan",
        summary: "A buildable plan agents and humans can follow.",
        substages: [
          {
            id: "spec-doc",
            name: "Buildable spec",
            summary: "Spec, OpenSpec proposal, or equivalent plan artifact.",
            criteria: [
              {
                id: "spec-exists",
                label: "Spec or plan exists",
                help: "Could be SpecKit, OpenSpec, or a plain plan doc.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Point to the spec/plan file or paste a link/path.",
              },
              {
                id: "spec-tasks",
                label: "Work broken into tasks",
                help: "Small enough pieces that progress is visible.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Add a task list the harness can work through.",
              },
              {
                id: "spec-approved",
                label: "Plan approved to build",
                help: "Human says: go ahead and implement this plan.",
                kind: "approval",
                required: true,
                howToSatisfy: "Approve the plan, or waive with an explicit reason.",
              },
            ],
          },
        ],
      },
      {
        id: "build",
        name: "Build",
        summary: "Implement, verify, and decide if this slice is ready.",
        substages: [
          {
            id: "implement",
            name: "Implement",
            summary: "Agents and humans write the change.",
            criteria: [
              {
                id: "build-done",
                label: "Core change implemented",
                help: "The planned slice exists in your project files.",
                kind: "checklist",
                required: true,
                howToSatisfy: "Mark when the main implementation for this slice is in place.",
              },
              {
                id: "build-smoke",
                label: "Smoke check passed",
                help: "You tried the happy path once.",
                kind: "harness_signal",
                required: true,
                howToSatisfy: "Run the app or tests once and record that it worked.",
              },
            ],
          },
          {
            id: "verify",
            name: "Verify & hand off",
            summary: "Confirm the slice meets the success picture.",
            criteria: [
              {
                id: "verify-success",
                label: "Success picture checked",
                help: "Compare against what you wrote in pre-requirements.",
                kind: "checklist",
                required: true,
                howToSatisfy: "Re-read the success picture and confirm it holds.",
              },
              {
                id: "verify-notes",
                label: "Known gaps noted",
                help: "Honest leftovers for the next slice.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Write a short gaps / follow-ups note.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "bug-fix",
    name: "Bug fix",
    tagline: "Reproduce → isolate → fix → prove it stays fixed.",
    audience: "Anyone chasing a concrete defect without a full spec cycle.",
    harnessNote: "Pair with any agent that can read logs, tests, and code changes.",
    stages: [
      {
        id: "triage",
        name: "Triage",
        summary: "Make the bug real and narrow.",
        substages: [
          {
            id: "repro",
            name: "Reproduce",
            summary: "Steps anyone can follow to see the failure.",
            criteria: [
              {
                id: "bug-steps",
                label: "Reproduction steps written",
                help: "Clear enough that a teammate can follow them.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Write numbered steps and expected vs actual.",
              },
              {
                id: "bug-seen",
                label: "Failure reproduced once",
                help: "You (or the harness) saw it happen.",
                kind: "checklist",
                required: true,
                howToSatisfy: "Mark when you personally reproduced the bug.",
              },
            ],
          },
          {
            id: "isolate",
            name: "Isolate",
            summary: "Where it breaks and what is out of scope.",
            criteria: [
              {
                id: "bug-area",
                label: "Likely area named",
                help: "Module, screen, or API — even if tentative.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Name the suspected file, service, or screen.",
              },
              {
                id: "bug-scope",
                label: "Fix scope bounded",
                help: "What this fix will not try to clean up.",
                kind: "checklist",
                required: true,
                howToSatisfy: "Confirm you are not expanding into a rewrite.",
              },
            ],
          },
        ],
      },
      {
        id: "fix",
        name: "Fix",
        summary: "Change the code and prove the bug is gone.",
        substages: [
          {
            id: "patch",
            name: "Patch",
            summary: "Smallest change that fixes the failure.",
            criteria: [
              {
                id: "fix-applied",
                label: "Fix applied",
                help: "The change is saved in your project files.",
                kind: "checklist",
                required: true,
                howToSatisfy: "Mark when the fix is saved and ready to ship.",
              },
              {
                id: "fix-retest",
                label: "Original steps now pass",
                help: "Same reproduction path, expected result.",
                kind: "harness_signal",
                required: true,
                howToSatisfy: "Re-run the reproduction steps and confirm success.",
              },
            ],
          },
          {
            id: "regress",
            name: "Regression guard",
            summary: "Leave a trail so this does not silently return.",
            criteria: [
              {
                id: "fix-test",
                label: "Automated or checklist guard added",
                help: "A test, assert, or documented manual check.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Add a test or a short regression checklist.",
              },
              {
                id: "fix-approve",
                label: "Ready to ship",
                help: "Human confirmation for the fix.",
                kind: "approval",
                required: true,
                howToSatisfy: "Approve the fix, or waive with a reason.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "prototype",
    name: "Prototype / spike",
    tagline: "Learn fast, throw away freely, write down what you learned.",
    audience: "Exploring an idea before committing to a full build path.",
    harnessNote: "Any harness; favor speed over polish.",
    stages: [
      {
        id: "question",
        name: "Question",
        summary: "What you need to learn.",
        substages: [
          {
            id: "ask",
            name: "Spike question",
            summary: "One question the prototype must answer.",
            criteria: [
              {
                id: "spike-q",
                label: "Learning question written",
                help: "If you cannot state the question, you are not ready to build.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Write the single question this spike answers.",
              },
              {
                id: "spike-timebox",
                label: "Timebox set",
                help: "When you will stop even if unsure.",
                kind: "checklist",
                required: true,
                howToSatisfy: "Pick a timebox (hours or a day) and mark it set.",
              },
            ],
          },
        ],
      },
      {
        id: "explore",
        name: "Explore",
        summary: "Build just enough to learn.",
        substages: [
          {
            id: "hack",
            name: "Hack it together",
            summary: "Disposable code is fine.",
            criteria: [
              {
                id: "spike-built",
                label: "Something runnable exists",
                help: "A demo path, not production quality.",
                kind: "checklist",
                required: true,
                howToSatisfy: "Mark when you can show the spike running once.",
              },
              {
                id: "spike-answer",
                label: "Question answered in writing",
                help: "Yes / no / depends — with one paragraph why.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Write the answer and what you would do next.",
              },
            ],
          },
        ],
      },
      {
        id: "decide",
        name: "Decide",
        summary: "Keep, pivot, or stop.",
        substages: [
          {
            id: "call",
            name: "Call the shot",
            summary: "A human decision, not agent vibes.",
            criteria: [
              {
                id: "spike-decision",
                label: "Keep / pivot / stop decided",
                help: "Record the decision so the spike does not linger forever.",
                kind: "approval",
                required: true,
                howToSatisfy: "Approve with keep, pivot, or stop in the note.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "content-ops",
    name: "Content & ops change",
    tagline: "Draft → review → publish, without pretending it is an SDLC.",
    audience: "Non-engineers shipping copy, config, or ops runbooks with agent help.",
    harnessNote: "Works beside docs tools, CMS, or a repo of markdown.",
    stages: [
      {
        id: "draft",
        name: "Draft",
        summary: "Get the words or steps down.",
        substages: [
          {
            id: "outline",
            name: "Outline",
            summary: "Audience and outline before polishing.",
            criteria: [
              {
                id: "content-audience",
                label: "Audience named",
                help: "Who will read or follow this.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Write one sentence naming the audience.",
              },
              {
                id: "content-outline",
                label: "Outline ready",
                help: "Headings or steps in order.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Save an outline or step list.",
              },
            ],
          },
          {
            id: "body",
            name: "Full draft",
            summary: "Complete draft for review.",
            criteria: [
              {
                id: "content-draft",
                label: "Full draft complete",
                help: "Not placeholder text.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Attach or confirm the full draft exists.",
              },
            ],
          },
        ],
      },
      {
        id: "review",
        name: "Review",
        summary: "Accuracy and tone before it goes live.",
        substages: [
          {
            id: "check",
            name: "Review pass",
            summary: "A human signs off.",
            criteria: [
              {
                id: "content-facts",
                label: "Facts checked",
                help: "Links, dates, names, and commands verified.",
                kind: "checklist",
                required: true,
                howToSatisfy: "Mark when you verified the factual bits.",
              },
              {
                id: "content-approve",
                label: "Ready to publish",
                help: "Explicit go-ahead.",
                kind: "approval",
                required: true,
                howToSatisfy: "Approve publish, or waive with a reason.",
              },
            ],
          },
        ],
      },
      {
        id: "publish",
        name: "Publish",
        summary: "Ship and note where it lives.",
        substages: [
          {
            id: "ship",
            name: "Go live",
            summary: "Published location recorded.",
            criteria: [
              {
                id: "content-live",
                label: "Published / updated",
                help: "Live link or path recorded.",
                kind: "artifact",
                required: true,
                howToSatisfy: "Paste the live URL or file path.",
              },
            ],
          },
        ],
      },
    ],
  },
];

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}

export function firstStageSubstage(template: WorkflowTemplate) {
  const stage = template.stages[0];
  const substage = stage.substages[0];
  return { stageId: stage.id, substageId: substage.id };
}

export function listAllCriteria(template: WorkflowTemplate) {
  return template.stages.flatMap((stage) =>
    stage.substages.flatMap((sub) =>
      sub.criteria.map((c) => ({ ...c, stageId: stage.id, substageId: sub.id })),
    ),
  );
}
