import { cn } from "@/lib/utils";

/**
 * Unhighlighted code.
 *
 * Shipping a syntax highlighter would add more to the bundle than every chart on
 * the site combined, and the snippets here are twenty lines of JSON or Python
 * that read fine in a single colour.
 */
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-bg-elevated", className)}>
      {label ? (
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            {label}
          </span>
        </div>
      ) : null}
      <pre className="scroll-x p-3.5 text-[12px] leading-relaxed">
        <code className="font-mono text-fg-muted">{code}</code>
      </pre>
    </div>
  );
}
