"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import { AXIS_PROPS, CHART_COLOURS, ChartFrame, ChartTooltip } from "@/components/charts/chart-kit";
import type { CalibrationBin } from "@/lib/types";

/**
 * Stated probability against observed frequency.
 *
 * The diagonal is perfect calibration. Bars below it mean overconfidence — the
 * most common failure mode in the course, and the reason this chart exists on
 * every student page rather than being buried in a methodology appendix.
 */
export function CalibrationChart({
  bins,
  height = 260,
}: {
  bins: CalibrationBin[];
  height?: number;
}) {
  const data = bins
    .filter((bin) => bin.count > 0)
    .map((bin) => ({
      label: bin.label,
      stated: Math.round(bin.predictedProbability * 100),
      observed: Math.round(bin.observedRate * 100),
      ideal: Math.round(((bin.lower + bin.upper) / 2) * 100),
      count: bin.count,
    }));

  if (data.length === 0) {
    return <p className="px-1 py-8 text-center text-xs text-fg-subtle">No resolved predictions yet.</p>;
  }

  return (
    <ChartFrame
      height={height}
      caption="Bars are the share of predictions in each bin that actually reached +10%. The dashed line is perfect calibration: a bar below the line at 80% means the model said 80% and was right less often than that."
    >
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={CHART_COLOURS.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} domain={[0, 100]} unit="%" width={44} />
        <ChartTooltip
          formatter={(value, name) =>
            name === "count" ? `${value} predictions` : `${value}%`
          }
        />
        <Bar
          dataKey="observed"
          name="Observed"
          fill={CHART_COLOURS.accent}
          radius={[3, 3, 0, 0]}
          maxBarSize={38}
        />
        <Line
          dataKey="ideal"
          name="Perfect calibration"
          stroke={CHART_COLOURS.muted}
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
        />
      </ComposedChart>
    </ChartFrame>
  );
}
