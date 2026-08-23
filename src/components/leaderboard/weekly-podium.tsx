import Link from "next/link";

import { Avatar, Panel, PanelHeader } from "@/components/ui/primitives";
import type { PredictionCycle } from "@/lib/types";
import type { WeeklyPodiumEntry } from "@/lib/data/queries";
import { cn, pct, returnTone, signedPct } from "@/lib/utils";

const STEP_HEIGHT = { 1: "h-24 sm:h-28", 2: "h-16 sm:h-20", 3: "h-12 sm:h-14" } as const;
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;

/**
 * The weekly winner block.
 *
 * Ordered 2–1–3 visually so the tallest step sits in the middle, which is how a
 * podium reads at a glance, while the DOM order stays 1–2–3 for screen readers.
 */
export function WeeklyPodium({
  cycle,
  podium,
}: {
  cycle: PredictionCycle;
  podium: WeeklyPodiumEntry[];
}) {
  if (podium.length === 0) return null;
  const order = [podium[1], podium[0], podium[2]].filter(Boolean) as WeeklyPodiumEntry[];

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Weekly podium"
        description={`Most hits in cycle ${cycle.id}. Resolved predictions only.`}
      />

      <div className="grid grid-cols-3 items-end gap-2 px-4 pb-5 pt-8 sm:gap-3 sm:px-6">
        {order.map((entry) => (
          <div key={entry.student.id} className="flex flex-col items-center gap-2">
            <span className="text-xl sm:text-2xl" aria-hidden>
              {MEDAL[entry.rank as 1 | 2 | 3]}
            </span>
            <Avatar
              name={entry.student.name}
              seed={entry.student.avatarSeed}
              size={entry.rank === 1 ? 44 : 36}
            />
            <Link
              href={`/students/${entry.student.id}`}
              className="line-clamp-2 max-w-full px-1 text-center text-[11px] font-medium leading-tight hover:text-accent-fg sm:text-xs"
            >
              {entry.student.name}
            </Link>

            <div
              className={cn(
                "flex w-full flex-col items-center justify-center gap-0.5 rounded-t-lg border border-b-0 px-1",
                STEP_HEIGHT[entry.rank as 1 | 2 | 3],
                entry.rank === 1
                  ? "border-metal/40 bg-gradient-to-b from-metal/20 to-transparent"
                  : "border-border bg-gradient-to-b from-surface-hover to-transparent",
              )}
            >
              <span className="tnum text-base font-semibold sm:text-lg">{entry.hits}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-fg-subtle">
                hits / {entry.resolved}
              </span>
              <span className={cn("tnum text-[10px]", returnTone(entry.averageReturn))}>
                {signedPct(entry.averageReturn)}
              </span>
              <span className="tnum text-[10px] text-fg-muted">{pct(entry.hitRate, 0)}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
