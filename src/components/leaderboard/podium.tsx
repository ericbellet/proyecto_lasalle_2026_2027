import Link from "next/link";

import { Celebrate } from "@/components/ui/celebrate";
import type { LeaderboardEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const METAL = {
  1: {
    label: "Gold",
    disc: "liquid-metal border-metal/55",
    numeral: "text-[#2a1f08]",
    glow: "bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-metal)_24%,transparent),transparent_72%)]",
    ring: "border-metal/40",
    step: "from-metal/45 via-metal/20 to-transparent",
  },
  2: {
    label: "Silver",
    disc: "liquid-silver border-white/30",
    numeral: "text-[#1c222c]",
    glow: "bg-[radial-gradient(ellipse_at_top,rgb(196_205_216_/_0.18),transparent_72%)]",
    ring: "border-fg-subtle/35",
    step: "from-white/25 via-white/10 to-transparent",
  },
  3: {
    label: "Bronze",
    disc: "liquid-bronze border-[#c47a3a]/45",
    numeral: "text-[#2a1608]",
    glow: "bg-[radial-gradient(ellipse_at_top,rgb(196_122_58_/_0.20),transparent_72%)]",
    ring: "border-warning/30",
    step: "from-[#c47a3a]/40 via-[#c47a3a]/15 to-transparent",
  },
} as const;

/**
 * Season podium. DOM order is 1–2–3 for screen readers; on desktop, CSS
 * reorders to silver · gold · bronze so the tallest step sits in the middle.
 */
export function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const first = entries.find((entry) => !entry.provisional && entry.rank === 1);
  const second = entries.find((entry) => !entry.provisional && entry.rank === 2);
  const third = entries.find((entry) => !entry.provisional && entry.rank === 3);
  if (!first) return null;

  return (
    <section aria-label="Season podium" className="relative">
      <Celebrate once={`champion:${first.student.id}`} />
      <ol className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 sm:gap-4">
        <li className="sm:order-2">
          <PodiumCard entry={first} featured />
        </li>
        {second ? (
          <li className="sm:order-1">
            <PodiumCard entry={second} />
          </li>
        ) : null}
        {third ? (
          <li className="sm:order-3">
            <PodiumCard entry={third} />
          </li>
        ) : null}
      </ol>
    </section>
  );
}

function PodiumCard({ entry, featured = false }: { entry: LeaderboardEntry; featured?: boolean }) {
  const metal = METAL[entry.rank as 1 | 2 | 3];
  if (!metal) return null;

  return (
    <div className="flex flex-col">
      <Link
        href={`/students/${entry.student.id}`}
        className={cn(
          "panel relative flex overflow-hidden p-5 transition-colors hover:bg-surface-hover",
          featured
            ? "flex-col items-center gap-4 sm:pb-8 sm:pt-10"
            : "items-center gap-4 sm:flex-col sm:pb-6 sm:pt-6",
          metal.ring,
        )}
      >
        <div className={cn("pointer-events-none absolute inset-0", metal.glow)} />

        <Medal rank={entry.rank} featured={featured} disc={metal.disc} numeral={metal.numeral} />

        <div
          className={cn(
            "relative min-w-0 flex-1",
            featured ? "sm:text-center" : "sm:flex-none sm:text-center",
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">{metal.label}</p>
          <p
            className={cn(
              "mt-1 truncate font-semibold tracking-tight",
              featured ? "text-xl sm:text-2xl" : "text-sm sm:text-base",
            )}
          >
            {entry.student.name}
          </p>
          <p className="mt-1.5 text-[12px] text-fg-muted">
            <span className={cn("tnum font-semibold", featured ? "text-metal" : "text-fg")}>
              {entry.score}
            </span>{" "}
            pts
          </p>
        </div>
      </Link>
      <div
        aria-hidden
        className={cn(
          "mx-8 hidden h-2 bg-gradient-to-b sm:block",
          featured ? "h-4" : "h-2",
          metal.step,
        )}
      />
    </div>
  );
}

function Medal({
  rank,
  featured,
  disc,
  numeral,
}: {
  rank: number;
  featured: boolean;
  disc: string;
  numeral: string;
}) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border shadow-[0_10px_36px_-10px_rgb(0_0_0_/_0.65)]",
        featured ? "size-[4.75rem] sm:size-28" : "size-14 sm:size-[4.25rem]",
        disc,
      )}
    >
      <span className="liquid-metal-sheen rounded-full" />
      <span className="pointer-events-none absolute inset-[3px] rounded-full border border-white/25" />
      <span
        className={cn(
          "relative z-10 font-mono font-bold",
          featured ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl",
          numeral,
        )}
      >
        {rank}
      </span>
    </span>
  );
}
