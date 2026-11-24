import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { askGatekeeper } from "./gatekeeper";
import { firstStageSubstage, getTemplate } from "./templates";
import type {
  CriterionState,
  ProjectState,
  ServerProjectState,
  WorkflowTemplate,
} from "./types";

const APPCODE_PATTERN = /^appcode-[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/;
export const APPCODE_MIN = 10;
export const APPCODE_MAX = 64;
export const SERVER_STORE_FILENAME = "stage-gate-projects.json";

export class ServerStoreError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid" | "conflict" | "not-found",
  ) {
    super(message);
    this.name = "ServerStoreError";
  }
}

export type AppcodeValidation =
  | { ok: true; appcode: string }
  | { ok: false; error: string };

/** Validate appcode format (`appcode-{slug}-{n}`, 10..64 lowercase chars). */
export function validateAppcode(input: unknown): AppcodeValidation {
  if (typeof input !== "string") {
    return { ok: false, error: "appcode must be a string" };
  }
  const trimmed = input.trim();
  if (trimmed !== input) {
    return { ok: false, error: "appcode must not have leading or trailing whitespace" };
  }
  if (trimmed.length < APPCODE_MIN || trimmed.length > APPCODE_MAX) {
    return {
      ok: false,
      error: `appcode must be ${APPCODE_MIN}-${APPCODE_MAX} characters long`,
    };
  }
  if (!APPCODE_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error:
        "appcode must match /^appcode-[a-z0-9]+(?:-[a-z0-9]+)*-\\d+$/ (e.g. appcode-demo-0)",
    };
  }
  return { ok: true, appcode: trimmed };
}

/** Return validated appcode or throw ServerStoreError("invalid"). */
export function assertValidAppcode(input: unknown): string {
  const check = validateAppcode(input);
  if (!check.ok) {
    throw new ServerStoreError(check.error, "invalid");
  }
  return check.appcode;
}

/** Lazily resolve server store data directory from MIREVOX_STAGE_GATE_DATA_DIR. */
export function serverDataDir(): string {
  const configured = process.env.MIREVOX_STAGE_GATE_DATA_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "data");
}

/** Lazily resolve full path to stage-gate-projects.json. */
export function serverStorePath(): string {
  return path.join(serverDataDir(), SERVER_STORE_FILENAME);
}

interface StoreFileShape {
  version: 1;
  projects: Record<string, ServerProjectState>;
}

function normalizeProject(raw: ServerProjectState): ServerProjectState {
  return {
    ...raw,
    criteria: raw.criteria && typeof raw.criteria === "object" ? raw.criteria : {},
    jiraApprovals: Array.isArray(raw.jiraApprovals) ? raw.jiraApprovals : [],
    processedEventIds: Array.isArray(raw.processedEventIds)
      ? raw.processedEventIds
      : [],
  };
}

function loadStore(): StoreFileShape {
  const filePath = serverStorePath();
  if (!existsSync(filePath)) {
    return { version: 1, projects: {} };
  }
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoreFileShape> | null;
  const projects: Record<string, ServerProjectState> = {};
  if (parsed && parsed.projects && typeof parsed.projects === "object") {
    for (const [key, value] of Object.entries(parsed.projects)) {
      if (value && typeof value === "object") {
        projects[key] = normalizeProject(value as ServerProjectState);
      }
    }
  }
  return { version: 1, projects };
}

function writeStoreAtomic(store: StoreFileShape): void {
  const dir = serverDataDir();
  mkdirSync(dir, { recursive: true });
  const targetPath = serverStorePath();
  const tmpPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmpPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    renameSync(tmpPath, targetPath);
  } catch (err) {
    try {
      if (existsSync(tmpPath)) {
        unlinkSync(tmpPath);
      }
    } catch {
      // Best-effort cleanup of orphaned temp file.
    }
    throw err;
  }
}

/**
 * Step `currentStageId`/`currentSubstageId` forward through unlocked substages,
 * or clamp back to the first blocking substage if an earlier stage became blocked.
 */
export function advanceProjectToFrontier<T extends ProjectState>(
  project: T,
  template?: WorkflowTemplate,
): T {
  const resolvedTemplate = template ?? getTemplate(project.templateId);
  if (!resolvedTemplate) {
    throw new ServerStoreError(
      `Unknown workflow template "${project.templateId}"`,
      "invalid",
    );
  }

  const ordered = resolvedTemplate.stages.flatMap((stage) =>
    stage.substages.map((sub) => ({ stage, sub })),
  );
  if (ordered.length === 0) {
    return project;
  }

  let frontierIdx = 0;
  for (let i = 0; i < ordered.length; i += 1) {
    frontierIdx = i;
    const { stage, sub } = ordered[i];
    const verdict = askGatekeeper(resolvedTemplate, project, {
      stageId: stage.id,
      substageId: sub.id,
    });
    if (!verdict.canAdvance) {
      break;
    }
  }

  const frontier = ordered[frontierIdx];
  if (
    project.currentStageId !== frontier.stage.id ||
    project.currentSubstageId !== frontier.sub.id
  ) {
    project.currentStageId = frontier.stage.id;
    project.currentSubstageId = frontier.sub.id;
  }

  return project;
}

/** List all server-persisted projects sorted by appcode. */
export function listServerProjects(): ServerProjectState[] {
  const store = loadStore();
  return Object.values(store.projects).sort((a, b) =>
    a.appcode.localeCompare(b.appcode),
  );
}

/** Look up a server-persisted project by validated appcode. */
export function getServerProject(appcode: string): ServerProjectState | undefined {
  const valid = assertValidAppcode(appcode);
  const store = loadStore();
  return store.projects[valid];
}

export interface CreateServerProjectInput {
  appcode: string;
  name?: string;
  harness?: string;
  templateId?: string;
  criteria?: Record<string, CriterionState>;
}

/** Create and atomically persist a new server project keyed by appcode. */
export function createServerProject(
  input: CreateServerProjectInput,
): ServerProjectState {
  const appcode = assertValidAppcode(input.appcode);
  const templateId = input.templateId?.trim() || "spec-driven";
  const template = getTemplate(templateId);
  if (!template) {
    throw new ServerStoreError(`Unknown template "${templateId}"`, "invalid");
  }

  const store = loadStore();
  if (store.projects[appcode]) {
    throw new ServerStoreError(`Project "${appcode}" already exists`, "conflict");
  }

  const { stageId, substageId } = firstStageSubstage(template);
  const now = new Date().toISOString();
  const project: ServerProjectState = {
    id: appcode,
    appcode,
    name: input.name?.trim() || appcode,
    harness: input.harness?.trim() || "Any harness",
    templateId,
    createdAt: now,
    updatedAt: now,
    criteria: input.criteria ? structuredClone(input.criteria) : {},
    currentStageId: stageId,
    currentSubstageId: substageId,
    jiraApprovals: [],
    processedEventIds: [],
  };

  advanceProjectToFrontier(project, template);
  store.projects[appcode] = project;
  writeStoreAtomic(store);
  return normalizeProject(structuredClone(project));
}

/** Atomically save an updated server project keyed by appcode. */
export function saveServerProject(
  project: ServerProjectState,
): ServerProjectState {
  const appcode = assertValidAppcode(project.appcode);
  const template = getTemplate(project.templateId);
  if (!template) {
    throw new ServerStoreError(
      `Unknown template "${project.templateId}"`,
      "invalid",
    );
  }

  const store = loadStore();
  const next: ServerProjectState = normalizeProject({
    ...structuredClone(project),
    id: project.id || appcode,
    appcode,
    updatedAt: new Date().toISOString(),
  });
  store.projects[appcode] = next;
  writeStoreAtomic(store);
  return normalizeProject(structuredClone(next));
}
