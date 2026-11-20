"use client";

import { Badge } from "@/components/ui/badge";
import {
  isStageUnlocked,
  isSubstageUnlocked,
  stageProgress,
} from "@/lib/gatekeeper";
import type { ProjectState, WorkflowTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

export function StageRail({
  template,
  project,
  onSelect,
}: {
  template: WorkflowTemplate;
  project: ProjectState;
  onSelect: (stageId: string, substageId: string) => void;
}) {
  return (
    <nav className="space-y-4" aria-label="Workflow stages">
      {template.stages.map((stage, index) => {
        const unlocked = isStageUnlocked(template, project, stage.id);
        const progress = stageProgress(stage, project);
        const isCurrent = project.currentStageId === stage.id;

        return (
          <div key={stage.id} className="relative">
            {index < template.stages.length - 1 && (
              <div className="absolute left-[15px] top-10 bottom-[-16px] w-px bg-[var(--line)]" />
            )}
            <div
              className={cn(
                "relative rounded-xl border p-3 transition-colors",
                isCurrent
                  ? "border-[var(--neon)]/40 bg-[var(--neon)]/5"
                  : "border-[var(--line)] bg-[var(--panel)]/40",
                !unlocked && "opacity-55",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                      isCurrent
                        ? "border-[var(--neon)] text-[var(--neon)]"
                        : "border-[var(--line)] text-[var(--muted)]",
                    )}
                  >
                    {unlocked ? index + 1 : <Lock className="h-3.5 w-3.5" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{stage.name}</p>
                    <p className="text-xs text-[var(--muted)]">{stage.summary}</p>
                  </div>
                </div>
                <Badge tone={progress.ready ? "ok" : isCurrent ? "neon" : "neutral"}>
                  {progress.done}/{progress.total}
                </Badge>
              </div>

              <ul className="ml-10 space-y-1.5">
                {stage.substages.map((sub) => {
                  const subUnlocked = isSubstageUnlocked(
                    template,
                    project,
                    stage.id,
                    sub.id,
                  );
                  const active =
                    project.currentStageId === stage.id &&
                    project.currentSubstageId === sub.id;
                  return (
                    <li key={sub.id}>
                      <button
                        type="button"
                        disabled={!subUnlocked}
                        onClick={() => onSelect(stage.id, sub.id)}
                        className={cn(
                          "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                          active
                            ? "bg-[var(--neon)]/15 text-[var(--neon)]"
                            : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]",
                          !subUnlocked && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {sub.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
