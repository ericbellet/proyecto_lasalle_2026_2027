"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { AXIS_PROPS, CHART_COLOURS, ChartFrame, ChartTooltip } from "@/components/charts/chart-kit";

/**
 * Rank over time, plotted with an inverted axis so "up" means "better".
 */
export function RankHistoryChart({
  history,
  cohortSize,
  height = 220,
}: {
  history: Array<{ cycleId: string; rank: number; score: number }>;
  cohortSize: number;
  height?: number;
}) {
  if (history.length < 2) {
    return (
      <p className="px-1 py-8 text-center text-xs text-fg-subtle">
        Not enough resolved cycles to plot a trend yet.
      </p>
    );
  }

  const data = history.map((row) => ({
    cycle: row.cycleId.replace(/^\d{4}-/, ""),
    rank: row.rank,
    score: Number(row.score.toFixed(1)),
  }));

  return (
    <ChartFrame
      height={height}
      caption="Rank recomputed after every cycle using only the data available at that point. Higher on the chart is a better rank."
    >
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
        <CartesianGrid stroke={CHART_COLOURS.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="cycle" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={24} />
        <YAxis
          {...AXIS_PROPS}
          reversed
          domain={[1, cohortSize]}
          allowDecimals={false}
          width={38}
        />
        <ChartTooltip
          formatter={(value, name) => (name === "rank" ? `#${value}` : String(value))}
          labelFormatter={(label) => `Cycle ${label}`}
        />
        <Line
          dataKey="rank"
          name="rank"
          stroke={CHART_COLOURS.accent}
          strokeWidth={2}
          dot={{ r: 2, fill: CHART_COLOURS.accent, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartFrame>
  );
}
