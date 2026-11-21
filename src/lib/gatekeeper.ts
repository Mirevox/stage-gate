import type {
  AdvanceVerdict,
  AuditFinding,
  CriterionState,
  GateCheckResult,
  ProjectState,
  Stage,
  Substage,
  WorkflowTemplate,
} from "./types";

function criterionState(
  project: ProjectState,
  criterionId: string,
): CriterionState {
  return project.criteria[criterionId] ?? { status: "pending" };
}

function evaluateSubstage(
  substage: Substage,
  project: ProjectState,
): {
  met: GateCheckResult[];
  unmet: GateCheckResult[];
  waived: GateCheckResult[];
  canAdvance: boolean;
} {
  const met: GateCheckResult[] = [];
  const unmet: GateCheckResult[] = [];
  const waived: GateCheckResult[] = [];

  for (const c of substage.criteria) {
    const state = criterionState(project, c.id);
    const row: GateCheckResult = {
      criterionId: c.id,
      label: c.label,
      required: c.required,
      status: state.status,
      howToSatisfy: c.howToSatisfy,
      note: state.note,
      evidence: state.evidence,
    };
    if (state.status === "met") met.push(row);
    else if (state.status === "waived" && Boolean(state.note?.trim())) waived.push(row);
    else if (state.status === "waived") {
      // Reasonless waiver does not pass (FR-07) — treat as unmet pending.
      unmet.push({ ...row, status: "pending" });
    } else unmet.push({ ...row, status: state.status === "blocked" ? "blocked" : "pending" });
  }

  const blocking = unmet.filter((u) => u.required);
  return { met, unmet, waived, canAdvance: blocking.length === 0 };
}

export function findStage(
  template: WorkflowTemplate,
  stageId: string,
): Stage | undefined {
  return template.stages.find((s) => s.id === stageId);
}

export function findSubstage(
  stage: Stage,
  substageId: string,
): Substage | undefined {
  return stage.substages.find((s) => s.id === substageId);
}

export function stageProgress(
  stage: Stage,
  project: ProjectState,
): { total: number; done: number; ready: boolean } {
  const all = stage.substages.flatMap((s) => s.criteria);
  let done = 0;
  for (const c of all) {
    const st = criterionState(project, c.id).status;
    if (st === "met" || st === "waived") done += 1;
  }
  const ready = stage.substages.every(
    (sub) => evaluateSubstage(sub, project).canAdvance,
  );
  return { total: all.length, done, ready };
}

/** Audit criterion notes and evidence for shallow or placeholder sign-offs. */
export function auditSubstageContent(
  substage: Substage,
  project: ProjectState,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const placeholderRe = /\b(todo|tbd|fixme|placeholder|n\/a)\b/i;

  for (const c of substage.criteria) {
    const state = criterionState(project, c.id);
    if (state.status !== "met" && state.status !== "waived") continue;

    const noteTrim = state.note?.trim() ?? "";
    const evidenceTrim = state.evidence?.trim() ?? "";

    if (
      state.status === "met" &&
      (c.kind === "artifact" ||
        c.kind === "approval" ||
        c.kind === "harness_signal") &&
      !noteTrim &&
      !evidenceTrim
    ) {
      findings.push({
        criterionId: c.id,
        label: c.label,
        severity: "warn",
        message: `Marked met without evidence or note for ${c.kind} check.`,
      });
    }

    if (
      (noteTrim && (placeholderRe.test(noteTrim) || noteTrim.length < 4)) ||
      (evidenceTrim &&
        (placeholderRe.test(evidenceTrim) || evidenceTrim.length < 4))
    ) {
      findings.push({
        criterionId: c.id,
        label: c.label,
        severity: "warn",
        message:
          "Evidence or note contains a placeholder or is too short to audit.",
      });
    }
  }

  return findings;
}

/** Plain-language Gatekeeper: when can I advance from the current substage? */
export function askGatekeeper(
  template: WorkflowTemplate,
  project: ProjectState,
  opts?: { stageId?: string; substageId?: string; strictAudit?: boolean },
): AdvanceVerdict {
  const stageId = opts?.stageId ?? project.currentStageId;
  const substageId = opts?.substageId ?? project.currentSubstageId;
  const stage = findStage(template, stageId);
  const substage = stage ? findSubstage(stage, substageId) : undefined;

  if (!stage || !substage) {
    return {
      canAdvance: false,
      stageId,
      substageId,
      stageName: "Unknown",
      substageName: "Unknown",
      summary: "This step is missing from the workflow template.",
      met: [],
      unmet: [],
      waived: [],
      nextAction: "Pick a valid stage from the board.",
      auditFindings: [],
    };
  }

  const evalResult = evaluateSubstage(substage, project);
  const { met, unmet, waived } = evalResult;
  const auditFindings = auditSubstageContent(substage, project);
  const strictBlocked = Boolean(opts?.strictAudit && auditFindings.length > 0);
  const canAdvance = evalResult.canAdvance && !strictBlocked;
  const requiredUnmet = unmet.filter((u) => u.required);

  let summary: string;
  let nextAction: string;

  const blocked = requiredUnmet.filter((u) => u.status === "blocked");

  if (canAdvance) {
    const next = nextSubstage(template, stageId, substageId);
    if (next) {
      summary = `Yes — you can leave “${substage.name}”. Required checks are met or waived.`;
      nextAction = `Advance to “${next.substageName}” in “${next.stageName}”.`;
    } else {
      summary = `Yes — “${substage.name}” is complete. This workflow has no further steps.`;
      nextAction = "All steps are satisfied — switch projects or start a new one.";
    }
  } else if (strictBlocked && requiredUnmet.length === 0) {
    summary = `Not yet. Strict audit flagged ${auditFindings.length} check(s) needing stronger evidence or notes.`;
    nextAction = auditFindings[0].message;
  } else if (blocked.length > 0) {
    summary =
      blocked.length === 1
        ? `Not yet. “${blocked[0].label}” is marked blocked.`
        : `Not yet. ${blocked.length} required checks are marked blocked.`;
    nextAction =
      "Resolve or waive each blocked check with a written reason before advancing.";
  } else if (requiredUnmet.length === 1) {
    const only = requiredUnmet[0];
    summary = `Not yet. One required check is still open: “${only.label}”.`;
    nextAction = only.howToSatisfy;
  } else {
    summary = `Not yet. ${requiredUnmet.length} required checks still need attention.`;
    nextAction = requiredUnmet[0]?.howToSatisfy ?? "Complete the open checks below.";
  }

  return {
    canAdvance,
    stageId,
    substageId,
    stageName: stage.name,
    substageName: substage.name,
    summary,
    met,
    unmet,
    waived,
    nextAction,
    auditFindings,
  };
}

export function nextSubstage(
  template: WorkflowTemplate,
  stageId: string,
  substageId: string,
): { stageId: string; stageName: string; substageId: string; substageName: string } | null {
  const stageIndex = template.stages.findIndex((s) => s.id === stageId);
  if (stageIndex < 0) return null;
  const stage = template.stages[stageIndex];
  const subIndex = stage.substages.findIndex((s) => s.id === substageId);
  if (subIndex < 0) return null;

  if (subIndex + 1 < stage.substages.length) {
    const next = stage.substages[subIndex + 1];
    return {
      stageId: stage.id,
      stageName: stage.name,
      substageId: next.id,
      substageName: next.name,
    };
  }

  if (stageIndex + 1 < template.stages.length) {
    const nextStage = template.stages[stageIndex + 1];
    const next = nextStage.substages[0];
    return {
      stageId: nextStage.id,
      stageName: nextStage.name,
      substageId: next.id,
      substageName: next.name,
    };
  }

  return null;
}

export function previousSubstage(
  template: WorkflowTemplate,
  stageId: string,
  substageId: string,
): { stageId: string; substageId: string } | null {
  const stageIndex = template.stages.findIndex((s) => s.id === stageId);
  if (stageIndex < 0) return null;
  const stage = template.stages[stageIndex];
  const subIndex = stage.substages.findIndex((s) => s.id === substageId);
  if (subIndex < 0) return null;

  if (subIndex > 0) {
    return { stageId: stage.id, substageId: stage.substages[subIndex - 1].id };
  }
  if (stageIndex > 0) {
    const prevStage = template.stages[stageIndex - 1];
    const prev = prevStage.substages[prevStage.substages.length - 1];
    return { stageId: prevStage.id, substageId: prev.id };
  }
  return null;
}

/** A stage is reachable if all prior stages' substages can advance. */
export function isStageUnlocked(
  template: WorkflowTemplate,
  project: ProjectState,
  stageId: string,
): boolean {
  for (const stage of template.stages) {
    if (stage.id === stageId) return true;
    for (const sub of stage.substages) {
      if (!evaluateSubstage(sub, project).canAdvance) return false;
    }
  }
  return false;
}

export function isSubstageUnlocked(
  template: WorkflowTemplate,
  project: ProjectState,
  stageId: string,
  substageId: string,
): boolean {
  if (!isStageUnlocked(template, project, stageId)) return false;
  const stage = findStage(template, stageId);
  if (!stage) return false;
  for (const sub of stage.substages) {
    if (sub.id === substageId) return true;
    if (!evaluateSubstage(sub, project).canAdvance) return false;
  }
  return false;
}
