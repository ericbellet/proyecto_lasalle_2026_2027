"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import { AXIS_PROPS, CHART_COLOURS, ChartFrame, ChartTooltip } from "@/components/charts/chart-kit";

/**
 * The price path between a prediction and its resolution.
 *
 * The reference line is the +10% target, which turns an abstract "hit" or "miss"
 * into something you can see: how close it got, and whether it touched the
 * target and gave it back.
 */
export function PricePathChart({
  path,
  entryPrice,
  targetReturn,
  hit,
  height = 220,
}: {
  path: Array<{ date: string; close: number }>;
  entryPrice: number;
  targetReturn: number;
  hit: boolean | null;
  height?: number;
}) {
  if (path.length < 2) {
    return (
      <p className="px-1 py-8 text-center text-xs text-fg-subtle">
        No price history available for this window.
      </p>
    );
  }

  const data = path.map((point) => ({
    date: point.date.slice(5),
    close: Number(point.close.toFixed(2)),
    change: Number((((point.close - entryPrice) / entryPrice) * 100).toFixed(2)),
  }));

  const target = entryPrice * (1 + targetReturn);
  const tone = hit === null ? CHART_COLOURS.accent : hit ? CHART_COLOURS.positive : CHART_COLOURS.negative;

  return (
    <ChartFrame
      height={height}
      caption={`Entry at $${entryPrice.toFixed(2)}. The dashed line is the +${Math.round(targetReturn * 100)}% target that decides hit or miss.`}
    >
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="path-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity={0.28} />
            <stop offset="100%" stopColor={tone} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_COLOURS.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="date" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={32} />
        <YAxis {...AXIS_PROPS} domain={["auto", "auto"]} width={52} />
        <ChartTooltip
          formatter={(value, name) =>
            name === "close" ? `$${Number(value).toFixed(2)}` : `${value}%`
          }
        />
        <ReferenceLine
          y={target}
          stroke={CHART_COLOURS.positive}
          strokeDasharray="4 4"
          strokeWidth={1.25}
        />
        <ReferenceLine y={entryPrice} stroke={CHART_COLOURS.muted} strokeWidth={1} />
        <Area dataKey="close" name="close" stroke={tone} strokeWidth={2} fill="url(#path-fill)" />
      </AreaChart>
    </ChartFrame>
  );
}
