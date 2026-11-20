import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "ok" | "warn" | "danger" | "neon" | "locked";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "neutral" && "bg-white/5 text-[var(--muted)] border border-[var(--line)]",
        tone === "ok" && "bg-emerald-500/15 text-emerald-200 border border-emerald-400/25",
        tone === "warn" && "bg-amber-500/15 text-amber-100 border border-amber-400/25",
        tone === "danger" && "bg-rose-500/15 text-rose-200 border border-rose-400/25",
        tone === "neon" && "bg-[var(--neon)]/15 text-[var(--neon)] border border-[var(--neon)]/30",
        tone === "locked" && "bg-white/5 text-[var(--muted)] border border-[var(--line)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
