"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { formatDate } from "@/lib/dates";
import { cn, returnTone, signedPct } from "@/lib/utils";

const DISPLAY_CAP = 48;

export type SlimPickRow = {
  id: string;
  studentId: string;
  studentName: string;
  ticker: string;
  horizon: string;
  deadline: string;
  actual: number | null;
  points: number | null;
};

/**
 * Compact pick table. Slim rows (not full prediction objects) keep the
 * leaderboard HTML small enough that the browser actually paints.
 */
export function PickBoard({ rows }: { rows: SlimPickRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center sm:px-6">
        <p className="text-sm font-medium">No picks yet</p>
        <p className="mt-1 text-xs text-fg-muted">No student has submitted a prediction yet.</p>
      </div>
    );
  }

  const truncated = rows.length > DISPLAY_CAP;
  const visible = truncated ? rows.slice(0, DISPLAY_CAP) : rows;

  return (
    <div>
      <div className="scroll-x">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th>Student</Th>
              <Th>Stock</Th>
              <Th>Horizon</Th>
              <Th>Deadline</Th>
              <Th align="right">Actual</Th>
              <Th align="right">Pts</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const open = row.actual === null;
              return (
                <tr key={row.id} className="border-b border-border/70 transition-colors hover:bg-surface-hover">
                  <Td>
                    <Link href={`/students/${row.studentId}`} className="font-medium hover:text-accent-fg">
                      {row.studentName}
                    </Link>
                  </Td>
                  <Td>
                    <span className="tnum font-semibold">{row.ticker}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] text-fg-muted">{row.horizon}</span>
                  </Td>
                  <Td className={cn("tnum whitespace-nowrap text-xs", open ? "text-fg" : "text-fg-muted")}>
                    {formatDate(row.deadline)}
                  </Td>
                  <Td align="right" className={cn("tnum", row.actual !== null ? returnTone(row.actual) : "text-fg-subtle")}>
                    <Link href={`/predictions/${row.id}`} className="hover:underline">
                      {row.actual !== null ? signedPct(row.actual) : "—"}
                    </Link>
                  </Td>
                  <Td align="right">
                    <Link href={`/predictions/${row.id}`}>
                      {row.points === null ? (
                        <span className="tnum text-fg-subtle">—</span>
                      ) : (
                        <span className={cn("tnum font-semibold", row.points > 0 ? "text-positive" : "text-fg-muted")}>
                          {row.points}
                        </span>
                      )}
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {truncated ? (
        <p className="border-t border-border px-4 py-3 text-[11px] text-fg-subtle sm:px-6">
          Showing the first {DISPLAY_CAP} of {rows.length} picks. Narrow a filter to see the rest.
        </p>
      ) : null}
    </div>
  );
}

function Th({ children, align }: { children: string; align?: "right" }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle sm:px-6",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children: ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-2.5 align-middle sm:px-6", align === "right" && "text-right", className)}>
      {children}
    </td>
  );
}
