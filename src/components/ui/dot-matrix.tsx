import { cn } from "@/lib/utils";

/**
 * Dot-matrix activity indicator.
 *
 * Used for anything that talks to sixteen student deployments at once: the grid
 * makes "several things are happening in parallel" legible in a way a spinner
 * cannot, and each dot can carry a per-student state.
 */
export function DotMatrix({
  count = 16,
  columns = 8,
  states,
  className,
}: {
  count?: number;
  columns?: number;
  /** Optional per-dot state. Falls back to an idle pulse when omitted. */
  states?: Array<"pending" | "ok" | "error" | "idle">;
  className?: string;
}) {
  const tone = {
    pending: "bg-accent",
    ok: "bg-positive",
    error: "bg-negative",
    idle: "bg-border-strong",
  } as const;

  return (
    <div
      className={cn("grid w-fit gap-1", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="presentation"
    >
      {Array.from({ length: count }, (_, index) => {
        const state = states?.[index] ?? "pending";
        return (
          <span
            key={index}
            className={cn("size-1.5 rounded-[2px]", tone[state])}
            style={
              states
                ? undefined
                : {
                    animation: "dot-pulse 1.4s ease-in-out infinite",
                    animationDelay: `${(index % columns) * 70 + Math.floor(index / columns) * 40}ms`,
                  }
            }
          />
        );
      })}
    </div>
  );
}

export function DotMatrixStatus({
  label,
  states,
  count = 16,
}: {
  label: string;
  states?: Array<"pending" | "ok" | "error" | "idle">;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <DotMatrix count={count} states={states} />
      <span className="font-mono text-[11px] tracking-tight text-fg-muted">{label}</span>
    </div>
  );
}
