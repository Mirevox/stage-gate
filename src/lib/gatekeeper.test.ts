import { askGatekeeper, nextSubstage } from "./gatekeeper";
import { WORKFLOW_TEMPLATES, getTemplate } from "./templates";
import type { ProjectState } from "./types";

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

// Waive with note counts as advance-ready
{
  const proto = getTemplate("prototype")!;
  const project = baseProject("prototype");
  for (const c of proto.stages[0].substages[0].criteria) {
    project.criteria[c.id] = { status: "waived", note: "Spike is disposable" };
  }
  const verdict = askGatekeeper(proto, project);
  assert(verdict.canAdvance, "waived required checks should advance");
  assert(verdict.waived.length >= 1, "waived list populated");
}

// Blocked status surfaces distinct Gatekeeper phrasing
{
  const content = getTemplate("content-ops")!;
  const project = baseProject("content-ops");
  const first = content.stages[0].substages[0].criteria[0];
  project.criteria[first.id] = { status: "blocked", note: "Waiting on legal" };
  const verdict = askGatekeeper(content, project);
  assert(!verdict.canAdvance, "blocked should not advance");
  assert(/blocked/i.test(verdict.summary), "summary mentions blocked");
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

// Spec-driven is one of several templates (not the only path)
assert(WORKFLOW_TEMPLATES.length >= 4, "expected at least four templates");
assert(
  WORKFLOW_TEMPLATES.some((t) => t.id !== "spec-driven"),
  "non-spec templates must exist",
);

console.log("gatekeeper.test.ts: ok");
