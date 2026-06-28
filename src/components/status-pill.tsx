import { cn } from "@/lib/utils";

const tones = {
  success: "bg-success/15 text-success border-success/25",
  warning: "bg-warning/20 text-warning-foreground border-warning/30",
  info: "bg-info/15 text-info border-info/25",
  danger: "bg-destructive/15 text-destructive border-destructive/25",
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/12 text-primary border-primary/25",
} as const;

export type Tone = keyof typeof tones;

export function StatusPill({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

export function statusToTone(status: string): Tone {
  const s = status.toLowerCase();
  if (["packed", "shipped", "delivered", "restocked", "matched", "active"].includes(s)) return "success";
  if (["queued", "received", "invited", "new", "waiting"].includes(s)) return "info";
  if (["ready", "assigned", "packing", "in_progress", "inspecting"].includes(s)) return "warning";
  if (["mismatch", "rejected", "disabled", "unknown", "returned", "cancelled"].includes(s)) return "danger";
  return "muted";
}
