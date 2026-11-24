export type CriterionKind =
  | "checklist"
  | "artifact"
  | "approval"
  | "harness_signal";

export type CriterionStatus = "pending" | "met" | "waived" | "blocked";

export type StageStatus =
  | "locked"
  | "active"
  | "ready"
  | "complete"
  | "skipped";

export interface GateCriterion {
  id: string;
  label: string;
  help: string;
  kind: CriterionKind;
  required: boolean;
  /** Hint shown when unmet — plain language for non-technical users */
  howToSatisfy: string;
}

export interface Substage {
  id: string;
  name: string;
  summary: string;
  criteria: GateCriterion[];
}

export interface Stage {
  id: string;
  name: string;
  summary: string;
  substages: Substage[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  tagline: string;
  audience: string;
  harnessNote: string;
  stages: Stage[];
}

export type CriterionProvenance =
  | "manual"
  | "context-inferred"
  | "jira-approval";

export interface CriterionState {
  status: CriterionStatus;
  note?: string;
  evidence?: string;
  updatedAt?: string;
  provenance?: CriterionProvenance;
  sourceRef?: string;
  approver?: string;
}

export interface ProjectState {
  id: string;
  name: string;
  harness: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
  /** criterionId → state */
  criteria: Record<string, CriterionState>;
  /** stageId of the furthest unlocked stage */
  currentStageId: string;
  /** substageId currently focused */
  currentSubstageId: string;
  appcode?: string;
  provenance?: CriterionProvenance;
  sourceRef?: string;
  approver?: string;
  lastEvaluatedAt?: string;
}

export interface ContextDocumentInput {
  docId?: string;
  doc_id?: string;
  source?: string;
  stage?: string | null;
  title?: string;
  path?: string;
  ref?: string | null;
  content?: string;
  summary?: string;
  provenance?: string;
  updatedAt?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface RejectedContextFinding {
  docId: string;
  source?: string;
  path?: string;
  title?: string;
  criterionId?: string;
  reason: string;
  wordCount?: number;
  uniqueTokenCount?: number;
}

export interface ContextEvaluationResult {
  appcode: string;
  evaluatedAt: string;
  contextEngineConfigured: boolean;
  contextEngineReachable: boolean;
  contextEngineError?: string;
  documentsExamined: number;
  documentsAccepted: number;
  inferredStageId: string;
  inferredSubstageId: string;
  newlySatisfiedCriteria: string[];
  alreadySatisfiedCriteria: string[];
  qualityScorePct: number;
  rejectedFindings: RejectedContextFinding[];
  verdict: AdvanceVerdict;
}

export type JiraApprovalStatus =
  | "approved"
  | "rejected"
  | "blocked"
  | "waived"
  | "pending";

export interface JiraApprovalRecord {
  eventId: string;
  issueKey: string;
  stageId: string;
  criterionId: string;
  approvalStatus: JiraApprovalStatus;
  approver?: string;
  summary?: string;
  waiverReason?: string;
  occurredAt: string;
  recordedAt: string;
  applied: boolean;
  ignoredReason?: string;
}

export interface ServerProjectState extends ProjectState {
  appcode: string;
  jiraApprovals: JiraApprovalRecord[];
  processedEventIds: string[];
  lastContextEvaluation?: ContextEvaluationResult;
}

export interface GateCheckResult {
  criterionId: string;
  label: string;
  required: boolean;
  status: CriterionStatus;
  howToSatisfy: string;
  note?: string;
  evidence?: string;
}

export interface AuditFinding {
  criterionId: string;
  label: string;
  severity: "warn" | "fail";
  message: string;
}

export interface AdvanceVerdict {
  canAdvance: boolean;
  stageId: string;
  substageId: string;
  stageName: string;
  substageName: string;
  summary: string;
  met: GateCheckResult[];
  unmet: GateCheckResult[];
  waived: GateCheckResult[];
  nextAction: string;
  auditFindings?: AuditFinding[];
}
