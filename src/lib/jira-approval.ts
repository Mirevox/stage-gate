import { randomUUID } from "node:crypto";
import { askGatekeeper, findStage, isStageUnlocked, stageProgress } from "./gatekeeper";
import {
  advanceProjectToFrontier,
  assertValidAppcode,
  getServerProject,
  saveServerProject,
  ServerStoreError,
} from "./server-store";
import { getTemplate } from "./templates";
import type {
  CriterionStatus,
  GateCriterion,
  JiraApprovalRecord,
  JiraApprovalStatus,
  ServerProjectState,
  WorkflowTemplate,
} from "./types";

const REQUEST_TIMEOUT_MS = 2500;
const VALID_APPROVAL_STATUSES = new Set<JiraApprovalStatus>([
  "approved",
  "rejected",
  "blocked",
  "waived",
  "pending",
]);

export type ShadowVersioningStage =
  | "pre-requirements"
  | "requirements"
  | "build"
  | "test"
  | "release";

export interface JiraApprovalInput {
  issueKey: string;
  stageId?: string;
  criterionId?: string;
  approvalStatus: JiraApprovalStatus;
  approver?: string;
  summary?: string;
  occurredAt?: string;
  waiverReason?: string;
  eventId?: string;
}

export interface StageEventEmissionResult {
  attempted: boolean;
  delivered: boolean;
  targetUrl?: string;
  mappedStage?: ShadowVersioningStage;
  statusCode?: number;
  error?: string;
}

export interface JiraApprovalProcessResult {
  ok: true;
  applied: boolean;
  duplicate: boolean;
  stale: boolean;
  ignoredReason?: string;
  record: JiraApprovalRecord;
  previousStageId: string;
  previousSubstageId: string;
  currentStageId: string;
  currentSubstageId: string;
  project: ServerProjectState;
  stageEvent: StageEventEmissionResult;
}

/** Lazy lookup for SHADOW_VERSIONING_URL (never evaluated at module top level). */
export function getShadowVersioningUrl(override?: string): string | undefined {
  const candidate = override?.trim() || process.env.SHADOW_VERSIONING_URL?.trim();
  return candidate ? candidate.replace(/\/+$/, "") : undefined;
}

/** Map stage-gate stage IDs to shadow-versioning STAGES (`pre-requirements`, `requirements`, `build`, `release`). */
export function mapStageGateToShadowStage(
  stageGateStageId: string,
  template: WorkflowTemplate,
  project: ServerProjectState,
): ShadowVersioningStage {
  switch (stageGateStageId) {
    case "pre-req":
    case "triage":
    case "question":
    case "draft":
      return "pre-requirements";
    case "requirements":
    case "spec":
    case "decide":
    case "review":
      return "requirements";
    case "publish":
      return "release";
    case "build": {
      const buildStage = findStage(template, "build");
      if (
        buildStage &&
        isStageUnlocked(template, project, "build") &&
        stageProgress(buildStage, project).ready
      ) {
        return "release";
      }
      return "build";
    }
    case "fix": {
      const fixStage = findStage(template, "fix");
      if (
        fixStage &&
        isStageUnlocked(template, project, "fix") &&
        stageProgress(fixStage, project).ready
      ) {
        return "release";
      }
      return "build";
    }
    case "explore":
      return "build";
    default:
      return "build";
  }
}

function resolveApprovalTarget(
  template: WorkflowTemplate,
  project: ServerProjectState,
  input: JiraApprovalInput,
): { stageId: string; criterion: GateCriterion } {
  const allApprovals: Array<{ stageId: string; criterion: GateCriterion }> = [];
  for (const stage of template.stages) {
    for (const sub of stage.substages) {
      for (const criterion of sub.criteria) {
        if (criterion.kind === "approval") {
          allApprovals.push({ stageId: stage.id, criterion });
        }
      }
    }
  }

  const requestedCriterionId = input.criterionId?.trim();
  const requestedStageId = input.stageId?.trim();

  if (requestedCriterionId) {
    for (const stage of template.stages) {
      for (const sub of stage.substages) {
        const found = sub.criteria.find((c) => c.id === requestedCriterionId);
        if (found) {
          if (found.kind !== "approval") {
            throw new ServerStoreError(
              `Criterion "${requestedCriterionId}" has kind "${found.kind}"; Jira approvals may only target approval criteria`,
              "invalid",
            );
          }
          if (requestedStageId && requestedStageId !== stage.id) {
            throw new ServerStoreError(
              `Criterion "${requestedCriterionId}" belongs to stage "${stage.id}", not "${requestedStageId}"`,
              "invalid",
            );
          }
          return { stageId: stage.id, criterion: found };
        }
      }
    }
    throw new ServerStoreError(
      `Unknown criterionId "${requestedCriterionId}" for template "${template.id}"`,
      "invalid",
    );
  }

  if (requestedStageId) {
    const stage = findStage(template, requestedStageId);
    if (!stage) {
      throw new ServerStoreError(
        `Unknown stageId "${requestedStageId}" for template "${template.id}"`,
        "invalid",
      );
    }
    const approval = allApprovals.find((a) => a.stageId === stage.id);
    if (!approval) {
      throw new ServerStoreError(
        `Stage "${requestedStageId}" has no approval criterion`,
        "invalid",
      );
    }
    return approval;
  }

  const inCurrentStage = allApprovals.find(
    (a) => a.stageId === project.currentStageId,
  );
  if (inCurrentStage) {
    return inCurrentStage;
  }

  const firstUnmet = allApprovals.find((a) => {
    const status = project.criteria[a.criterion.id]?.status;
    return status !== "met" && status !== "waived";
  });
  if (firstUnmet) {
    return firstUnmet;
  }

  if (allApprovals.length > 0) {
    return allApprovals[allApprovals.length - 1];
  }

  throw new ServerStoreError(
    `Template "${template.id}" defines no approval criteria`,
    "invalid",
  );
}

function mapStatusToCriterionStatus(
  approvalStatus: JiraApprovalStatus,
): CriterionStatus {
  switch (approvalStatus) {
    case "approved":
      return "met";
    case "rejected":
    case "blocked":
      return "blocked";
    case "waived":
      return "waived";
    case "pending":
      return "pending";
  }
}

async function emitShadowStageEvent(params: {
  appcode: string;
  mappedStage: ShadowVersioningStage;
  outcome: string;
  detail: string;
  issueKey: string;
  occurredAt: string;
  stageGateStageId: string;
  stageGateSubstageId: string;
  criterionId: string;
  approvalStatus: JiraApprovalStatus;
  shadowVersioningUrl?: string;
}): Promise<StageEventEmissionResult> {
  const baseUrl = getShadowVersioningUrl(params.shadowVersioningUrl);
  if (!baseUrl) {
    return { attempted: false, delivered: false };
  }

  const targetUrl = `${baseUrl}/api/projects/${encodeURIComponent(params.appcode)}/stage-events`;
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: params.mappedStage,
        outcome: params.outcome,
        detail: params.detail,
        ref: params.issueKey,
        occurredAt: params.occurredAt,
        originSource: "stage-gate",
        skipStageGateCallback: true,
        hopCount: 1,
        stageGateStageId: params.stageGateStageId,
        stageGateSubstageId: params.stageGateSubstageId,
        criterionId: params.criterionId,
        approvalStatus: params.approvalStatus,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return {
      attempted: true,
      delivered: response.ok,
      targetUrl,
      mappedStage: params.mappedStage,
      statusCode: response.status,
      error: response.ok
        ? undefined
        : `shadow-versioning returned HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      attempted: true,
      delivered: false,
      targetUrl,
      mappedStage: params.mappedStage,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Process a Jira approval webhook / transition for a persisted project.
 * Enforces FR-07 waiver reasons, deduplicates `eventId`, ignores stale `occurredAt`,
 * clamps or advances the frontier via `advanceProjectToFrontier`, and emits a
 * loop-guarded non-blocking stage event to `SHADOW_VERSIONING_URL` if configured.
 */
export async function processJiraApproval(
  appcodeInput: string,
  input: JiraApprovalInput,
  options?: { shadowVersioningUrl?: string },
): Promise<JiraApprovalProcessResult> {
  const appcode = assertValidAppcode(appcodeInput);
  const issueKey = typeof input.issueKey === "string" ? input.issueKey.trim() : "";
  if (!issueKey) {
    throw new ServerStoreError("issueKey is required", "invalid");
  }

  if (!VALID_APPROVAL_STATUSES.has(input.approvalStatus)) {
    throw new ServerStoreError(
      `approvalStatus must be one of ${Array.from(VALID_APPROVAL_STATUSES).join(", ")}`,
      "invalid",
    );
  }

  const waiverReason =
    typeof input.waiverReason === "string" ? input.waiverReason.trim() : "";
  if (input.approvalStatus === "waived" && !waiverReason) {
    throw new ServerStoreError(
      "Waiving an approval gate requires a non-empty waiverReason (FR-07)",
      "invalid",
    );
  }

  let occurredAtIso: string;
  if (input.occurredAt !== undefined) {
    const parsed = Date.parse(String(input.occurredAt));
    if (Number.isNaN(parsed)) {
      throw new ServerStoreError("occurredAt must be a valid ISO timestamp", "invalid");
    }
    occurredAtIso = new Date(parsed).toISOString();
  } else {
    occurredAtIso = new Date().toISOString();
  }

  const project = getServerProject(appcode);
  if (!project) {
    throw new ServerStoreError(`Project "${appcode}" not found`, "not-found");
  }
  const template = getTemplate(project.templateId);
  if (!template) {
    throw new ServerStoreError(
      `Unknown template "${project.templateId}"`,
      "invalid",
    );
  }

  const { stageId, criterion } = resolveApprovalTarget(template, project, input);
  const eventId = input.eventId?.trim() || `jira-${randomUUID()}`;
  const nowIso = new Date().toISOString();
  const previousStageId = project.currentStageId;
  const previousSubstageId = project.currentSubstageId;

  if (project.processedEventIds.includes(eventId)) {
    const existingRecord =
      project.jiraApprovals.find((r) => r.eventId === eventId) ?? {
        eventId,
        issueKey,
        stageId,
        criterionId: criterion.id,
        approvalStatus: input.approvalStatus,
        approver: input.approver?.trim() || undefined,
        summary: input.summary?.trim() || undefined,
        waiverReason: waiverReason || undefined,
        occurredAt: occurredAtIso,
        recordedAt: nowIso,
        applied: false,
        ignoredReason: "duplicate_event_id",
      };
    return {
      ok: true,
      applied: false,
      duplicate: true,
      stale: false,
      ignoredReason: "duplicate_event_id",
      record: existingRecord,
      previousStageId,
      previousSubstageId,
      currentStageId: project.currentStageId,
      currentSubstageId: project.currentSubstageId,
      project,
      stageEvent: { attempted: false, delivered: false },
    };
  }

  const existingCriterion = project.criteria[criterion.id];
  if (existingCriterion?.updatedAt) {
    const existingMs = Date.parse(existingCriterion.updatedAt);
    const incomingMs = Date.parse(occurredAtIso);
    if (!Number.isNaN(existingMs) && incomingMs < existingMs) {
      const staleRecord: JiraApprovalRecord = {
        eventId,
        issueKey,
        stageId,
        criterionId: criterion.id,
        approvalStatus: input.approvalStatus,
        approver: input.approver?.trim() || undefined,
        summary: input.summary?.trim() || undefined,
        waiverReason: waiverReason || undefined,
        occurredAt: occurredAtIso,
        recordedAt: nowIso,
        applied: false,
        ignoredReason: "stale_event",
      };
      project.processedEventIds.push(eventId);
      project.jiraApprovals.push(staleRecord);
      const saved = saveServerProject(project);
      return {
        ok: true,
        applied: false,
        duplicate: false,
        stale: true,
        ignoredReason: "stale_event",
        record: staleRecord,
        previousStageId,
        previousSubstageId,
        currentStageId: saved.currentStageId,
        currentSubstageId: saved.currentSubstageId,
        project: saved,
        stageEvent: { attempted: false, delivered: false },
      };
    }
  }

  const approver = input.approver?.trim() || undefined;
  const summary = input.summary?.trim() || undefined;
  const nextStatus = mapStatusToCriterionStatus(input.approvalStatus);

  let note: string;
  if (input.approvalStatus === "waived") {
    note = waiverReason;
  } else if (summary) {
    note = summary;
  } else if (input.approvalStatus === "approved") {
    note = `Approved via Jira ${issueKey}${approver ? ` by ${approver}` : ""}.`;
  } else if (
    input.approvalStatus === "rejected" ||
    input.approvalStatus === "blocked"
  ) {
    note = `Blocked via Jira ${issueKey}${approver ? ` by ${approver}` : ""}.`;
  } else {
    note = `Reset to pending via Jira ${issueKey}.`;
  }

  project.criteria[criterion.id] = {
    status: nextStatus,
    provenance: "jira-approval",
    sourceRef: issueKey,
    approver,
    evidence: `jira:${issueKey}${approver ? ` (${approver})` : ""}`,
    note,
    updatedAt: occurredAtIso,
  };

  advanceProjectToFrontier(project, template);

  const record: JiraApprovalRecord = {
    eventId,
    issueKey,
    stageId,
    criterionId: criterion.id,
    approvalStatus: input.approvalStatus,
    approver,
    summary,
    waiverReason: waiverReason || undefined,
    occurredAt: occurredAtIso,
    recordedAt: nowIso,
    applied: true,
  };
  project.processedEventIds.push(eventId);
  project.jiraApprovals.push(record);

  const saved = saveServerProject(project);

  const verdict = askGatekeeper(template, saved);
  const mappedStage = mapStageGateToShadowStage(
    saved.currentStageId,
    template,
    saved,
  );
  const outcome =
    input.approvalStatus === "rejected"
      ? "blocked"
      : saved.currentStageId !== previousStageId ||
          saved.currentSubstageId !== previousSubstageId
        ? `${input.approvalStatus}:frontier-${saved.currentStageId}/${saved.currentSubstageId}`
        : input.approvalStatus;

  const stageEvent = await emitShadowStageEvent({
    appcode,
    mappedStage,
    outcome,
    detail: `Jira ${issueKey} marked ${criterion.id} (${stageId}) as ${input.approvalStatus} -> stage-gate frontier ${saved.currentStageId}/${saved.currentSubstageId}. ${verdict.summary}`,
    issueKey,
    occurredAt: occurredAtIso,
    stageGateStageId: saved.currentStageId,
    stageGateSubstageId: saved.currentSubstageId,
    criterionId: criterion.id,
    approvalStatus: input.approvalStatus,
    shadowVersioningUrl: options?.shadowVersioningUrl,
  });

  return {
    ok: true,
    applied: true,
    duplicate: false,
    stale: false,
    record,
    previousStageId,
    previousSubstageId,
    currentStageId: saved.currentStageId,
    currentSubstageId: saved.currentSubstageId,
    project: saved,
    stageEvent,
  };
}
