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

function saveAll(projects: ProjectState[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function getActiveProjectId(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProjectId(id: string | null) {
  if (!canUseStorage()) return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function getProject(id: string): ProjectState | undefined {
  return listProjects().find((p) => p.id === id);
}

export function upsertProject(project: ProjectState) {
  const all = listProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.unshift(project);
  saveAll(all);
}

export function deleteProject(id: string) {
  saveAll(listProjects().filter((p) => p.id !== id));
  if (getActiveProjectId() === id) setActiveProjectId(null);
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
