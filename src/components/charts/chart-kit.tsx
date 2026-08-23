"use client";

import type { ReactNode } from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

/**
 * Shared chart chrome.
 *
 * Recharts reads colours from props rather than CSS, so the theme variables have
 * to be resolved at render time. `currentColor` handles the common case and
 * `CHART_COLOURS` covers the rest — these are the same six hues the rest of the
 * app uses, hard-coded here because a chart cannot read a CSS custom property.
 */

export const CHART_COLOURS = {
  accent: "#7c6bff",
  cyan: "#35d6e5",
  positive: "#2fd98a",
  negative: "#ff5f6d",
  warning: "#f5b544",
  metal: "#e8c468",
  grid: "#2b3242",
  muted: "#949db4",
} as const;

export const AXIS_PROPS = {
  stroke: CHART_COLOURS.muted,
  tick: { fontSize: 11, fill: CHART_COLOURS.muted },
  tickLine: false,
  axisLine: false,
} as const;

/**
 * Charts get an explicit pixel height rather than an aspect ratio: a 16:9 chart
 * on a phone is 200px tall and unreadable, and `ResponsiveContainer` needs a
 * resolved height from its parent regardless.
 */
export function ChartFrame({
  height = 260,
  children,
  caption,
}: {
  height?: number;
  children: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as never}
        </ResponsiveContainer>
      </div>
      {caption ? (
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-fg-subtle">{caption}</p>
      ) : null}
    </div>
  );
}

export function ChartTooltip({
  formatter,
  labelFormatter,
}: {
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string) => string;
}) {
  return (
    <Tooltip
      cursor={{ stroke: CHART_COLOURS.grid, strokeWidth: 1 }}
      contentStyle={{
        background: "#0c0e14",
        border: "1px solid #2b3242",
        borderRadius: 10,
        fontSize: 12,
        padding: "8px 10px",
        boxShadow: "0 12px 40px -12px rgb(0 0 0 / 0.6)",
      }}
      itemStyle={{ color: "#e8ecf4", padding: "1px 0" }}
      labelStyle={{ color: "#949db4", fontSize: 11, marginBottom: 4 }}
      formatter={formatter as never}
      labelFormatter={labelFormatter as never}
    />
  );
}
