"use client";

import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { AXIS_PROPS, CHART_COLOURS, ChartFrame, ChartTooltip } from "@/components/charts/chart-kit";
import type { ModelEvolutionRow } from "@/lib/data/queries";

/**
 * RA1 versus RA2 versus RA3 for one student.
 *
 * Brier is inverted into a "calibration skill" bar (1 − Brier/0.25) so that all
 * three series point the same way; a chart where one bar is better when short is
 * a chart people misread.
 */
export function ModelEvolutionChart({
  evolution,
  height = 240,
}: {
  evolution: ModelEvolutionRow[];
  height?: number;
}) {
  if (evolution.length < 2) {
    return (
      <p className="px-1 py-8 text-center text-xs text-fg-subtle">
        Only one model generation has resolved predictions so far.
      </p>
    );
  }

  const data = evolution.map((row) => ({
    area: row.area,
    hitRate: Math.round(row.metrics.hitRate * 100),
    calibrationSkill: Math.round(Math.max(0, 1 - row.metrics.brierScore / 0.25) * 100),
    avgReturn: Number((row.metrics.averageReturn * 100).toFixed(1)),
  }));

  return (
    <ChartFrame
      height={height}
      caption="Calibration skill is 1 − Brier/0.25, so 0% means no better than always answering 50%. All three bars point the same way: taller is better."
    >
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
        <CartesianGrid stroke={CHART_COLOURS.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="area" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={40} />
        <ChartTooltip formatter={(value, name) => `${value}${name === "Avg return" ? "%" : "%"}`} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: CHART_COLOURS.muted, paddingTop: 6 }}
          iconType="circle"
          iconSize={7}
        />
        <Bar dataKey="hitRate" name="Hit rate" fill={CHART_COLOURS.accent} radius={[3, 3, 0, 0]} maxBarSize={34} />
        <Bar
          dataKey="calibrationSkill"
          name="Calibration skill"
          fill={CHART_COLOURS.cyan}
          radius={[3, 3, 0, 0]}
          maxBarSize={34}
        />
        <Bar
          dataKey="avgReturn"
          name="Avg return"
          fill={CHART_COLOURS.positive}
          radius={[3, 3, 0, 0]}
          maxBarSize={34}
        />
      </BarChart>
    </ChartFrame>
  );
}
