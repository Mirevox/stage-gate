import { askGatekeeper, nextSubstage } from "./gatekeeper";
import { getTemplate } from "./templates";
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

const bug = getTemplate("bug-fix")!;
const project = baseProject("bug-fix");
let verdict = askGatekeeper(bug, project);
assert(!verdict.canAdvance, "empty project should not advance");
assert(verdict.unmet.length >= 1, "should list unmet checks");

for (const c of bug.stages[0].substages[0].criteria) {
  project.criteria[c.id] = { status: "met" };
}
verdict = askGatekeeper(bug, project);
assert(verdict.canAdvance, "all met should advance");
const next = nextSubstage(bug, project.currentStageId, project.currentSubstageId);
assert(next?.substageId === "isolate", "next should be isolate");

console.log("gatekeeper.test.ts: ok");
