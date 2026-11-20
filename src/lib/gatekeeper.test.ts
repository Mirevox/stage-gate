import {
  askGatekeeper,
  isStageUnlocked,
  isSubstageUnlocked,
  nextSubstage,
  previousSubstage,
} from "./gatekeeper";
import { WORKFLOW_TEMPLATES, getTemplate, listAllCriteria } from "./templates";
import type { ProjectState, WorkflowTemplate } from "./types";

function baseProject(templateId: string): ProjectState {
  const template = getTemplate(templateId)!;
  const stage = template.stages[0];
  const sub = stage.substages[0];
  return {
    id: "test",
    name: "Test",
    harness: "Cursor",
    templateId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    criteria: {},
    currentStageId: stage.id,
    currentSubstageId: sub.id,
  };
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function meetAll(project: ProjectState, templateId: string) {
  const template = getTemplate(templateId)!;
  for (const stage of template.stages) {
    for (const sub of stage.substages) {
      for (const c of sub.criteria) {
        project.criteria[c.id] = { status: "met" };
      }
    }
  }
}

function meetSubstage(
  project: ProjectState,
  template: WorkflowTemplate,
  stageId: string,
  substageId: string,
) {
  const stage = template.stages.find((s) => s.id === stageId)!;
  const sub = stage.substages.find((s) => s.id === substageId)!;
  for (const c of sub.criteria) {
    project.criteria[c.id] = { status: "met" };
  }
}

// Empty project cannot advance
{
  const bug = getTemplate("bug-fix")!;
  const project = baseProject("bug-fix");
  const verdict = askGatekeeper(bug, project);
  assert(!verdict.canAdvance, "empty project should not advance");
  assert(verdict.unmet.length >= 1, "should list unmet checks");
}

// Meeting first substage unlocks next
{
  const bug = getTemplate("bug-fix")!;
  const project = baseProject("bug-fix");
  for (const c of bug.stages[0].substages[0].criteria) {
    project.criteria[c.id] = { status: "met" };
  }
  const verdict = askGatekeeper(bug, project);
  assert(verdict.canAdvance, "all met should advance");
  const next = nextSubstage(bug, project.currentStageId, project.currentSubstageId);
  assert(next?.substageId === "isolate", "next should be isolate");
}

// Waive with note counts as advance-ready (met vs waived partition)
{
  const proto = getTemplate("prototype")!;
  const project = baseProject("prototype");
  for (const c of proto.stages[0].substages[0].criteria) {
    project.criteria[c.id] = { status: "waived", note: "Spike is disposable" };
  }
  const verdict = askGatekeeper(proto, project);
  assert(verdict.canAdvance, "waived required checks should advance");
  assert(verdict.waived.length >= 1, "waived list populated");
  assert(verdict.met.length === 0, "waived checks must not appear in met[]");
}

// Blocked status surfaces distinct Gatekeeper phrasing
{
  const content = getTemplate("content-ops")!;
  const project = baseProject("content-ops");
  const first = content.stages[0].substages[0].criteria[0];
  project.criteria[first.id] = { status: "blocked", note: "Waiting on legal" };
  const verdict = askGatekeeper(content, project);
  assert(!verdict.canAdvance, "blocked should not advance");
  assert(verdict.unmet.some((u) => u.status === "blocked"), "blocked stays in unmet");
  assert(/blocked/i.test(verdict.summary), "summary mentions blocked");
}

// Optional (required: false) unmet criteria do not block advancement
{
  const template: WorkflowTemplate = {
    id: "optional-probe",
    name: "Optional probe",
    tagline: "test",
    audience: "test",
    harnessNote: "test",
    stages: [
      {
        id: "s1",
        name: "Stage",
        summary: "s",
        substages: [
          {
            id: "sub1",
            name: "Sub",
            summary: "s",
            criteria: [
              {
                id: "req",
                label: "Required",
                help: "must",
                kind: "checklist",
                required: true,
                howToSatisfy: "Mark done",
              },
              {
                id: "opt",
                label: "Optional",
                help: "nice",
                kind: "checklist",
                required: false,
                howToSatisfy: "Optional tip",
              },
            ],
          },
        ],
      },
    ],
  };
  const project = baseProject("bug-fix");
  project.templateId = "optional-probe";
  project.currentStageId = "s1";
  project.currentSubstageId = "sub1";
  project.criteria = { req: { status: "met" } };
  const verdict = askGatekeeper(template, project);
  assert(verdict.canAdvance, "optional unmet must not block");
  assert(
    verdict.unmet.some((u) => u.criterionId === "opt"),
    "optional unmet remains advisory in unmet[]",
  );
}

// Invalid stage/substage returns safe fallback (no throw)
{
  const bug = getTemplate("bug-fix")!;
  const project = baseProject("bug-fix");
  const verdict = askGatekeeper(bug, project, {
    stageId: "missing",
    substageId: "also-missing",
  });
  assert(!verdict.canAdvance, "invalid ids cannot advance");
  assert(/missing|unknown|pick/i.test(verdict.summary + verdict.nextAction), "safe message");
}

// Progressive unlock + backtrack reset re-locks without wiping downstream criteria
{
  const bug = getTemplate("bug-fix")!;
  const project = baseProject("bug-fix");
  meetSubstage(project, bug, "triage", "repro");
  assert(isSubstageUnlocked(bug, project, "triage", "isolate"), "isolate unlocks after repro");
  meetSubstage(project, bug, "triage", "isolate");
  assert(isStageUnlocked(bug, project, "fix"), "fix stage unlocks after triage");
  meetSubstage(project, bug, "fix", "patch");
  const patchId = bug.stages[1].substages[0].criteria[0].id;
  assert(project.criteria[patchId]?.status === "met", "downstream evidence present");

  // Reset an earlier required check
  const firstId = bug.stages[0].substages[0].criteria[0].id;
  project.criteria[firstId] = { status: "pending" };
  assert(!isStageUnlocked(bug, project, "fix"), "fix re-locks after backtrack reset");
  assert(
    project.criteria[patchId]?.status === "met",
    "downstream criteria entries preserved",
  );
}

// previousSubstage / nextSubstage edges
{
  const bug = getTemplate("bug-fix")!;
  const start = previousSubstage(bug, "triage", "repro");
  assert(start === null, "no previous before first substage");
  const end = nextSubstage(bug, "fix", "regress");
  assert(end === null, "no next after last substage");
}

// Template structural integrity (EX-03)
{
  const kinds = new Set<string>();
  assert(WORKFLOW_TEMPLATES.length === 4, "exactly four built-in templates");
  for (const template of WORKFLOW_TEMPLATES) {
    const ids = new Set<string>();
    assert(template.stages.length >= 1, `${template.id} needs stages`);
    for (const stage of template.stages) {
      assert(stage.substages.length >= 1, `${template.id}/${stage.id} needs substages`);
      for (const sub of stage.substages) {
        assert(sub.criteria.length >= 1, `${template.id}/${sub.id} needs criteria`);
        for (const c of sub.criteria) {
          assert(!ids.has(c.id), `duplicate criterion id ${c.id}`);
          ids.add(c.id);
          assert(c.help.trim().length > 0, `${c.id} help required`);
          assert(c.howToSatisfy.trim().length > 0, `${c.id} howToSatisfy required`);
          kinds.add(c.kind);
        }
      }
    }
    assert(listAllCriteria(template).length === ids.size, `${template.id} listAllCriteria`);
  }
  for (const kind of ["checklist", "artifact", "approval", "harness_signal"] as const) {
    assert(kinds.has(kind), `built-ins must cover kind ${kind}`);
  }
  assert(
    WORKFLOW_TEMPLATES.some((t) => t.id !== "spec-driven"),
    "non-spec templates must exist",
  );
}

// Every built-in template can reach a terminal advance after meeting all criteria
for (const template of WORKFLOW_TEMPLATES) {
  const project = baseProject(template.id);
  meetAll(project, template.id);
  const lastStage = template.stages[template.stages.length - 1];
  const lastSub = lastStage.substages[lastStage.substages.length - 1];
  project.currentStageId = lastStage.id;
  project.currentSubstageId = lastSub.id;
  const verdict = askGatekeeper(template, project);
  assert(verdict.canAdvance, `${template.id} last step should be advanceable`);
  assert(
    nextSubstage(template, lastStage.id, lastSub.id) === null,
    `${template.id} should have no next after last substage`,
  );
}

console.log("gatekeeper.test.ts: ok");
