"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdvanceVerdict } from "@/lib/types";
import { CheckCircle2, CircleAlert, ShieldQuestion } from "lucide-react";

export function GatekeeperPanel({
  verdict,
  onAdvance,
}: {
  verdict: AdvanceVerdict;
  onAdvance: () => void;
}) {
  return (
    <aside className="gatekeeper-panel relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--neon)]/10 blur-2xl" />
      <div className="relative space-y-4">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="h-5 w-5 text-[var(--neon)]" />
          <h2 className="text-sm font-semibold tracking-wide text-[var(--neon)]">
            Gatekeeper
          </h2>
        </div>
        <p className="text-lg font-medium leading-snug text-[var(--text)]">
          When can I advance?
        </p>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{verdict.summary}</p>

        <div className="rounded-lg border border-[var(--line)] bg-black/25 p-3">
          <p className="text-xs uppercase tracking-wider text-white/40">Next action</p>
          <p className="mt-1 text-sm text-[var(--text)]">{verdict.nextAction}</p>
        </div>

        <div className="space-y-2">
          {verdict.unmet.map((u) => (
            <div
              key={u.criterionId}
              className="flex items-start gap-2 text-sm text-amber-100/90"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>
                <span className="font-medium">{u.label}</span>
                <span className="block text-xs text-[var(--muted)]">{u.howToSatisfy}</span>
              </span>
            </div>
          ))}
          {verdict.met.map((m) => (
            <div
              key={m.criterionId}
              className="flex items-start gap-2 text-sm text-emerald-100/80"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <span>{m.label}</span>
            </div>
          ))}
          {verdict.waived.map((w) => (
            <div key={w.criterionId} className="flex items-center gap-2 text-sm">
              <Badge tone="warn">Waived</Badge>
              <span className="text-[var(--muted)]">{w.label}</span>
            </div>
          ))}
        </div>

        <Button
          className="w-full"
          disabled={!verdict.canAdvance}
          onClick={onAdvance}
        >
          {verdict.canAdvance ? "Advance to next step" : "Complete checks to advance"}
        </Button>
      </div>
    </aside>
  );
}
