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

export interface CriterionState {
  status: CriterionStatus;
  note?: string;
  evidence?: string;
  updatedAt?: string;
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
