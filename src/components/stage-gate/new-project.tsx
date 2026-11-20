"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HARNESS_PRESETS } from "@/lib/storage";
import { WORKFLOW_TEMPLATES } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function NewProjectForm({
  onCreate,
}: {
  onCreate: (input: { name: string; templateId: string; harness: string }) => void;
}) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(WORKFLOW_TEMPLATES[0].id);
  const [harness, setHarness] = useState<string>(HARNESS_PRESETS[0]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--neon)]">Mirevox</p>
        <h1 className="font-display text-4xl leading-tight text-[var(--text)] sm:text-5xl">
          Stage-gate
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-[var(--muted)]">
          A visual workflow on top of any AI harness. Pick a template, walk the
          stages, and ask Gatekeeper when you can advance — without learning Git
          verbs or living in an agent transcript.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">1. Name this work</h2>
        <input
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[var(--text)] placeholder:text-white/30 focus:border-[var(--neon)]/50 focus:outline-none"
          placeholder="e.g. Appointment booking v1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">
          2. Choose a workflow template
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Spec-driven is one path — not the only one.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {WORKFLOW_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                templateId === t.id
                  ? "border-[var(--neon)]/50 bg-[var(--neon)]/10"
                  : "border-[var(--line)] bg-[var(--panel)]/60 hover:border-white/20",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-[var(--text)]">{t.name}</span>
                {templateId === t.id && <Badge tone="neon">Selected</Badge>}
              </div>
              <p className="text-sm text-[var(--muted)]">{t.tagline}</p>
              <p className="mt-2 text-xs text-white/35">{t.audience}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">
          3. Which harness are you using?
        </h2>
        <div className="flex flex-wrap gap-2">
          {HARNESS_PRESETS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHarness(h)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                harness === h
                  ? "border-[var(--neon)]/50 bg-[var(--neon)]/15 text-[var(--neon)]"
                  : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              {h}
            </button>
          ))}
        </div>
      </section>

      <Button
        size="lg"
        className="w-full sm:w-auto"
        onClick={() => onCreate({ name, templateId, harness })}
      >
        Start workflow
      </Button>
    </div>
  );
}
