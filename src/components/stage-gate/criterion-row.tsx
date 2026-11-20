"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CriterionState, GateCriterion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

const KIND_LABEL: Record<GateCriterion["kind"], string> = {
  checklist: "Checklist",
  artifact: "Artifact",
  approval: "Approval",
  harness_signal: "Harness check (self-reported)",
};

export function CriterionRow({
  criterion,
  state,
  onChange,
}: {
  criterion: GateCriterion;
  state: CriterionState;
  onChange: (next: CriterionState) => void;
}) {
  const status = state.status ?? "pending";
  const [waiverHint, setWaiverHint] = useState<string | null>(null);
  const noteInputId = `note-${criterion.id}`;

  const tryWaive = () => {
    const note = (state.note ?? "").trim();
    if (!note) {
      setWaiverHint("Add a short reason in the note field before waiving.");
      const el = document.getElementById(noteInputId) as HTMLInputElement | null;
      el?.focus();
      return;
    }
    setWaiverHint(null);
    onChange({ ...state, status: "waived", note });
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--line)] bg-[var(--panel)]/70 p-4 transition-colors",
        status === "met" && "border-emerald-400/25",
        status === "waived" && "border-amber-400/25",
        status === "blocked" && "border-rose-400/30",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-[var(--text)]">{criterion.label}</h4>
            {criterion.required ? (
              <Badge tone="neon">Required</Badge>
            ) : (
              <Badge>Optional</Badge>
            )}
            <Badge>{KIND_LABEL[criterion.kind]}</Badge>
            {status === "blocked" && <Badge tone="danger">Blocked</Badge>}
            {status === "waived" && <Badge tone="warn">Waived</Badge>}
            {status === "met" && <Badge tone="ok">Done</Badge>}
          </div>
          <p className="text-sm text-[var(--muted)]">{criterion.help}</p>
          <p className="text-xs text-[var(--muted)]/90">
            How to satisfy: {criterion.howToSatisfy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={status === "met" ? "default" : "secondary"}
            onClick={() => {
              setWaiverHint(null);
              onChange({ ...state, status: "met" });
            }}
          >
            Mark done
          </Button>
          <Button
            size="sm"
            variant={status === "waived" ? "default" : "secondary"}
            onClick={tryWaive}
          >
            Waive
          </Button>
          <Button
            size="sm"
            variant={status === "blocked" ? "danger" : "secondary"}
            onClick={() => {
              setWaiverHint(null);
              onChange({ ...state, status: "blocked" });
            }}
          >
            Mark blocked
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setWaiverHint(null);
              onChange({ status: "pending", note: undefined, evidence: undefined });
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {waiverHint && (
        <p className="mt-2 text-xs text-amber-200" role="status">
          {waiverHint}
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-[var(--muted)]">
          Evidence / link / path
          <input
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/30 px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)]/75 focus:border-[var(--neon)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]"
            placeholder="e.g. docs/requirements.md or a URL"
            value={state.evidence ?? ""}
            onChange={(e) => onChange({ ...state, evidence: e.target.value })}
          />
        </label>
        <label className="block text-xs text-[var(--muted)]" htmlFor={noteInputId}>
          Note (required when waiving)
          <input
            id={noteInputId}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/30 px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)]/75 focus:border-[var(--neon)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]"
            placeholder="Why this is done or waived"
            value={state.note ?? ""}
            onChange={(e) => {
              const nextNote = e.target.value;
              setWaiverHint(null);
              if (status === "waived" && !nextNote.trim()) {
                setWaiverHint("Waiver cleared — add a reason again, or mark done.");
                onChange({ ...state, note: nextNote, status: "pending" });
                return;
              }
              onChange({ ...state, note: nextNote });
            }}
          />
        </label>
      </div>
    </div>
  );
}
