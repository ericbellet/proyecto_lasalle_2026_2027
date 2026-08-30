import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn, hueFromSeed, initials } from "@/lib/utils";

/** ------------------------------------------------------------------ shell */

export function Panel({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("panel", className)} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  titleClassName,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-accent-fg">
            {eyebrow}
          </p>
        ) : null}
        <h2 className={cn("text-balance text-xl font-semibold tracking-tight sm:text-2xl", titleClassName)}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** ----------------------------------------------------------------- badges */

const BADGE_TONES = {
  neutral: "bg-surface-hover text-fg-muted border-border",
  accent: "bg-accent-soft text-accent-fg border-accent/30",
  positive: "bg-positive-soft text-positive border-positive/25",
  negative: "bg-negative-soft text-negative border-negative/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  cyan: "bg-cyan-soft text-cyan border-cyan/25",
  metal: "border-metal/40 bg-metal/10 text-metal",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** ---------------------------------------------------------------- buttons */

const BUTTON_VARIANTS = {
  primary: "bg-accent text-white hover:bg-accent/90 border-transparent",
  secondary: "bg-surface text-fg hover:bg-surface-hover border-border-strong",
  ghost: "bg-transparent text-fg-muted hover:text-fg hover:bg-surface-hover border-transparent",
  danger: "bg-negative-soft text-negative hover:bg-negative/20 border-negative/30",
} as const;

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
} as const;

interface ButtonBaseProps {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  className?: string;
  children: ReactNode;
}

export function buttonClass({
  variant = "secondary",
  size = "md",
  className,
}: Omit<ButtonBaseProps, "children">) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: ButtonBaseProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
}: ButtonBaseProps & { href: string }) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })}>
      {children}
    </Link>
  );
}

/** ------------------------------------------------------------------ stats */

export function Stat({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={cn("panel px-4 py-3.5", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
      <p className={cn("tnum mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl", tone)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-fg-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * A metric label with an explanation attached. Every scoring term on the
 * leaderboard carries one of these — the metrics are the syllabus, so they must
 * be readable without opening the docs.
 */
export function Explain({
  term,
  children,
  className,
}: {
  term: ReactNode;
  children: string;
  className?: string;
}) {
  return (
    <span
      title={children}
      className={cn(
        "cursor-help underline decoration-border-strong decoration-dotted underline-offset-4",
        className,
      )}
    >
      {term}
    </span>
  );
}

/** ---------------------------------------------------------------- avatars */

export function Avatar({
  name,
  seed,
  size = 36,
  className,
}: {
  name: string;
  seed: string;
  size?: number;
  className?: string;
}) {
  const hue = hueFromSeed(seed);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border font-semibold",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        color: `hsl(${hue} 70% 78%)`,
        borderColor: `hsl(${hue} 55% 32%)`,
        background: `linear-gradient(145deg, hsl(${hue} 45% 18%), hsl(${(hue + 40) % 360} 40% 12%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/** ----------------------------------------------------------------- tables */

/**
 * Horizontally scrollable table.
 *
 * `minWidth` is the point below which the columns stop being readable and the
 * table starts scrolling instead of squashing. Panels in a narrow grid column
 * need a smaller value than a full-width leaderboard, so it is a prop rather
 * than a constant.
 */
export function TableShell({
  children,
  className,
  minWidth = 720,
}: {
  children: ReactNode;
  className?: string;
  minWidth?: number;
}) {
  return (
    <div className={cn("scroll-x w-full", className)}>
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
  ...props
}: ComponentPropsWithoutRef<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-fg-subtle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  ...props
}: ComponentPropsWithoutRef<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "border-b border-border/60 px-3 py-2.5 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/** A tiny horizontal bar, used to make a 0–1 component readable at a glance. */
export function Meter({
  value,
  tone = "accent",
  className,
}: {
  value: number;
  tone?: "accent" | "positive" | "negative" | "metal";
  className?: string;
}) {
  const pctValue = Math.max(0, Math.min(1, value)) * 100;
  const colours = {
    accent: "bg-accent",
    positive: "bg-positive",
    negative: "bg-negative",
    metal: "bg-metal",
  } as const;

  return (
    <span
      className={cn("block h-1 w-full overflow-hidden rounded-full bg-border", className)}
      role="presentation"
    >
      <span className={cn("block h-full rounded-full", colours[tone])} style={{ width: `${pctValue}%` }} />
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? <p className="mt-1 text-xs text-fg-muted">{description}</p> : null}
    </div>
  );
}
