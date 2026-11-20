"use client";

import { CriterionRow } from "@/components/stage-gate/criterion-row";
import { GatekeeperPanel } from "@/components/stage-gate/gatekeeper-panel";
import { NewProjectForm } from "@/components/stage-gate/new-project";
import { StageRail } from "@/components/stage-gate/stage-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  askGatekeeper,
  findStage,
  findSubstage,
  nextSubstage,
} from "@/lib/gatekeeper";
import {
  advanceProject,
  createProject,
  deleteProject,
  getActiveProjectId,
  getProject,
  listProjects,
  setActiveProjectId,
  updateCriterion,
} from "@/lib/storage";
import { getTemplate } from "@/lib/templates";
import type { ProjectState } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function AppShell() {
  const [hydrated, setHydrated] = useState(false);
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [project, setProject] = useState<ProjectState | null>(null);
  const [viewStageId, setViewStageId] = useState<string | null>(null);
  const [viewSubstageId, setViewSubstageId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const refresh = (activeId?: string | null) => {
    const all = listProjects();
    setProjects(all);
    const id = activeId === undefined ? getActiveProjectId() : activeId;
    const current = id ? getProject(id) ?? null : null;
    setProject(current);
    if (current) {
      setViewStageId(current.currentStageId);
      setViewSubstageId(current.currentSubstageId);
      setActiveProjectId(current.id);
    }
  };

  useEffect(() => {
    refresh();
    setHydrated(true);
  }, []);

  const template = useMemo(
    () => (project ? getTemplate(project.templateId) : undefined),
    [project],
  );

  const stageId = viewStageId ?? project?.currentStageId ?? "";
  const substageId = viewSubstageId ?? project?.currentSubstageId ?? "";
  const stage = template && stageId ? findStage(template, stageId) : undefined;
  const substage =
    stage && substageId ? findSubstage(stage, substageId) : undefined;

  const verdict =
    template && project
      ? askGatekeeper(template, project, { stageId, substageId })
      : null;

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (!project || !template) {
    return (
      <main className="min-h-screen px-4 py-12 sm:px-8">
        <NewProjectForm
          onCreate={(input) => {
            const { project: created, write } = createProject(input);
            if (!write.ok) {
              setStorageError(write.reason);
              return;
            }
            setStorageError(null);
            refresh(created.id);
          }}
        />
        {storageError && (
          <div
            className="mx-auto mt-6 max-w-3xl rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100"
            role="alert"
          >
            {storageError}
          </div>
        )}
        {projects.length > 0 && (
          <section className="mx-auto mt-12 max-w-3xl space-y-3 border-t border-[var(--line)] pt-8">
            <h2 className="text-sm font-semibold text-[var(--text)]">Resume a project</h2>
            <ul className="space-y-2">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)]/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-[var(--text)]">{p.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {getTemplate(p.templateId)?.name} · {p.harness}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => refresh(p.id)}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--neon)]">
              Mirevox · Stage-gate
            </p>
            <h1 className="font-display text-2xl text-[var(--text)]">{project.name}</h1>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neon">{template.name}</Badge>
              <Badge>{project.harness}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActiveProjectId(null);
                setProject(null);
              }}
            >
              Switch project
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                const ok = window.confirm(
                  `Delete project “${project.name}”? This cannot be undone.`,
                );
                if (!ok) return;
                const result = deleteProject(project.id);
                if (!result.ok) {
                  setStorageError(result.reason);
                  return;
                }
                setStorageError(null);
                refresh(null);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </header>

      {storageError && (
        <div
          className="border-b border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100"
          role="alert"
        >
          {storageError}
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)_300px] sm:px-6">
        <StageRail
          template={template}
          project={project}
          viewStageId={stageId}
          viewSubstageId={substageId}
          onSelect={(s, sub) => {
            setViewStageId(s);
            setViewSubstageId(sub);
          }}
        />

        <section className="space-y-4">
          {stage && substage ? (
            <>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  {stage.name}
                </p>
                <h2 className="font-display text-3xl text-[var(--text)]">
                  {substage.name}
                </h2>
                <p className="text-[var(--muted)]">{substage.summary}</p>
                <p className="text-xs text-[var(--muted)]">{template.harnessNote}</p>
              </div>
              <div className="space-y-3">
                {substage.criteria.map((c) => (
                  <CriterionRow
                    key={c.id}
                    criterion={c}
                    state={project.criteria[c.id] ?? { status: "pending" }}
                    onChange={(next) => {
                      const result = updateCriterion(project.id, c.id, next);
                      if (!result) return;
                      if (!result.write.ok) {
                        setStorageError(result.write.reason);
                        return;
                      }
                      setStorageError(null);
                      setProject({ ...result.project });
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-[var(--muted)]">Select a step from the left.</p>
          )}
        </section>

        {verdict && (
          <GatekeeperPanel
            verdict={verdict}
            atFrontier={
              stageId === project.currentStageId &&
              substageId === project.currentSubstageId
            }
            hasNextStep={
              nextSubstage(
                template,
                project.currentStageId,
                project.currentSubstageId,
              ) !== null
            }
            onAdvance={() => {
              // Advance only from the project frontier (never from a backtracked view).
              const fromStage = project.currentStageId;
              const fromSub = project.currentSubstageId;
              if (stageId !== fromStage || substageId !== fromSub) return;
              const frontier = askGatekeeper(template, project, {
                stageId: fromStage,
                substageId: fromSub,
              });
              if (!frontier.canAdvance) return;
              const next = nextSubstage(template, fromStage, fromSub);
              if (!next) return;
              const result = advanceProject(project.id, {
                stageId: next.stageId,
                substageId: next.substageId,
              });
              if (!result) return;
              if (!result.write.ok) {
                setStorageError(result.write.reason);
                return;
              }
              setStorageError(null);
              setProject({ ...result.project });
              setViewStageId(next.stageId);
              setViewSubstageId(next.substageId);
            }}
          />
        )}
      </div>
    </div>
  );
}
