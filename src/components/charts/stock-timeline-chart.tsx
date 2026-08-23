"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import { AXIS_PROPS, CHART_COLOURS, ChartFrame, ChartTooltip } from "@/components/charts/chart-kit";

/**
 * Cohort confidence in a ticker plotted against what the price actually did.
 *
 * Two y-axes, which is normally a warning sign, but the whole point of the chart
 * is the relationship between an opinion and an outcome measured in different
 * units — indexing one to the other would hide the price level entirely.
 */
export function StockTimelineChart({
  timeline,
  height = 240,
}: {
  timeline: Array<{ cycleId: string; students: number; averageProbability: number; close: number | null }>;
  height?: number;
}) {
  const data = timeline
    .filter((row) => row.close !== null)
    .map((row) => ({
      cycle: row.cycleId.replace(/^\d{4}-/, ""),
      probability: Math.round(row.averageProbability * 100),
      close: Number((row.close as number).toFixed(2)),
      students: row.students,
    }));

  if (data.length < 2) {
    return (
      <p className="px-1 py-8 text-center text-xs text-fg-subtle">
        This ticker has been picked in fewer than two cycles.
      </p>
    );
  }

  return (
    <ChartFrame
      height={height}
      caption="Average stated probability across every student who picked this ticker in that cycle, against the closing price on the same day."
    >
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
        <defs>
          <linearGradient id="probability-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLOURS.accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLOURS.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_COLOURS.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="cycle" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={24} />
        <YAxis yAxisId="p" {...AXIS_PROPS} domain={[0, 100]} unit="%" width={44} />
        <YAxis
          yAxisId="price"
          orientation="right"
          {...AXIS_PROPS}
          domain={["auto", "auto"]}
          width={52}
        />
        <ChartTooltip
          formatter={(value, name) =>
            name === "Avg probability" ? `${value}%` : `$${Number(value).toFixed(2)}`
          }
          labelFormatter={(label) => `Cycle ${label}`}
        />
        <Area
          yAxisId="p"
          dataKey="probability"
          name="Avg probability"
          stroke={CHART_COLOURS.accent}
          strokeWidth={2}
          fill="url(#probability-fill)"
        />
        <Line
          yAxisId="price"
          dataKey="close"
          name="Close"
          stroke={CHART_COLOURS.cyan}
          strokeWidth={1.75}
          dot={false}
        />
      </ComposedChart>
    </ChartFrame>
  );
}
