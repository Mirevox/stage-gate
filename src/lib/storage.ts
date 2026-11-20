import { firstStageSubstage, getTemplate } from "./templates";
import type { CriterionState, ProjectState } from "./types";

const PROJECTS_KEY = "mirevox.stage-gate.projects";
const ACTIVE_KEY = "mirevox.stage-gate.active";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function listProjects(): ProjectState[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectState[];
  } catch {
    return [];
  }
}

export type StorageWriteResult = { ok: true } | { ok: false; reason: string };

function writeKey(key: string, value: string): StorageWriteResult {
  if (!canUseStorage()) return { ok: false, reason: "Storage unavailable." };
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (err) {
    const quota =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.code === 22);
    return {
      ok: false,
      reason: quota
        ? "Browser storage is full. Remove an old project or clear site data, then try again."
        : "Could not save to browser storage.",
    };
  }
}

function saveAll(projects: ProjectState[]): StorageWriteResult {
  return writeKey(PROJECTS_KEY, JSON.stringify(projects));
}

export function getActiveProjectId(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProjectId(id: string | null): StorageWriteResult {
  if (!canUseStorage()) return { ok: false, reason: "Storage unavailable." };
  if (id) return writeKey(ACTIVE_KEY, id);
  try {
    localStorage.removeItem(ACTIVE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not clear active project." };
  }
}

export function getProject(id: string): ProjectState | undefined {
  return listProjects().find((p) => p.id === id);
}

export function upsertProject(project: ProjectState): StorageWriteResult {
  const all = listProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.unshift(project);
  return saveAll(all);
}

export function deleteProject(id: string): StorageWriteResult {
  const result = saveAll(listProjects().filter((p) => p.id !== id));
  if (getActiveProjectId() === id) setActiveProjectId(null);
  return result;
}

export function createProject(input: {
  name: string;
  templateId: string;
  harness: string;
}): ProjectState {
  const template = getTemplate(input.templateId);
  if (!template) throw new Error(`Unknown template: ${input.templateId}`);
  const { stageId, substageId } = firstStageSubstage(template);
  const now = new Date().toISOString();
  const project: ProjectState = {
    id: crypto.randomUUID(),
    name: input.name.trim() || "Untitled project",
    harness: input.harness.trim() || "Any harness",
    templateId: input.templateId,
    createdAt: now,
    updatedAt: now,
    criteria: {},
    currentStageId: stageId,
    currentSubstageId: substageId,
  };
  upsertProject(project);
  setActiveProjectId(project.id);
  return project;
}

export function updateCriterion(
  projectId: string,
  criterionId: string,
  patch: Partial<CriterionState>,
): ProjectState | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;
  const prev = project.criteria[criterionId] ?? { status: "pending" as const };
  project.criteria[criterionId] = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  project.updatedAt = new Date().toISOString();
  upsertProject(project);
  return project;
}

export function advanceProject(
  projectId: string,
  next: { stageId: string; substageId: string },
): ProjectState | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;
  project.currentStageId = next.stageId;
  project.currentSubstageId = next.substageId;
  project.updatedAt = new Date().toISOString();
  upsertProject(project);
  return project;
}

export const HARNESS_PRESETS = [
  "Cursor",
  "VS Code + side agent",
  "GitHub Copilot coding agent",
  "Claude / ChatGPT in browser",
  "Local CLI agent",
  "Other / mixed",
] as const;
