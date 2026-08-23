import { AlertTriangle, Info, TrendingUp } from "lucide-react";

import type { Insight } from "@/lib/data/queries";
import { cn } from "@/lib/utils";

const TONES = {
  positive: { icon: TrendingUp, className: "border-positive/25 bg-positive-soft/40 text-positive" },
  neutral: { icon: Info, className: "border-border bg-surface text-accent-fg" },
  negative: { icon: AlertTriangle, className: "border-warning/25 bg-warning-soft/40 text-warning" },
} as const;

export function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {insights.map((insight) => {
        const tone = TONES[insight.tone];
        const Icon = tone.icon;
        return (
          <li key={insight.id} className="panel flex items-start gap-3 p-4">
            <span
              className={cn("grid size-7 shrink-0 place-items-center rounded-md border", tone.className)}
            >
              <Icon className="size-3.5" />
            </span>
            <p className="text-pretty text-[13px] leading-relaxed text-fg-muted">{insight.text}</p>
          </li>
        );
      })}
    </ul>
  );
}
