import Link from "next/link";

import { Badge, EmptyState, Td, Th, TableShell } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { pointsForPick } from "@/lib/predictions/outcome";
import type { ResolvedPrediction, Student } from "@/lib/types";
import { cn, returnTone, signedPct } from "@/lib/utils";

export type PredictionsTableShow = "ticker" | "student" | "both";

/**
 * One row per pick: student, stock, horizon, deadline, actual return, points.
 *
 * Points are not awarded until the deadline. `show` hides the identity column
 * that the surrounding page already names.
 */
export function PredictionsTable({
  predictions,
  show = "both",
  students,
  emptyTitle = "No predictions here",
  emptyDescription,
}: {
  predictions: ResolvedPrediction[];
  show?: PredictionsTableShow;
  students?: Map<string, Student>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (predictions.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const showStudent = show === "student" || show === "both";
  const showTicker = show === "ticker" || show === "both";

  return (
    <TableShell minWidth={show === "both" ? 640 : 520}>
      <thead>
        <tr>
          {showStudent ? <Th>Student</Th> : null}
          {showTicker ? <Th>Stock</Th> : null}
          <Th>Horizon</Th>
          <Th>Deadline</Th>
          <Th align="right">Actual</Th>
          <Th align="right">Pts</Th>
        </tr>
      </thead>
      <tbody>
        {predictions.map((prediction) => {
          const result = prediction.result;
          const student = students?.get(prediction.studentId);
          const points = pointsForPick(prediction);
          const open = result === null;

          return (
            <tr key={prediction.id} className="transition-colors hover:bg-surface-hover">
              {showStudent ? (
                <Td>
                  <Link
                    href={`/students/${prediction.studentId}`}
                    className="font-medium hover:text-accent-fg"
                  >
                    {student?.name ?? prediction.studentId}
                  </Link>
                </Td>
              ) : null}
              {showTicker ? (
                <Td>
                  <span className="tnum font-semibold">{prediction.ticker}</span>
                </Td>
              ) : null}
              <Td>
                <span className="font-mono text-[11px] text-fg-muted">{prediction.horizon}</span>
              </Td>
              <Td className={cn("tnum whitespace-nowrap text-xs", open ? "text-fg" : "text-fg-muted")}>
                {formatDate(prediction.resolutionDate)}
              </Td>
              <Td
                align="right"
                className={cn("tnum", result ? returnTone(result.realizedReturn) : "text-fg-subtle")}
              >
                <Link href={`/predictions/${prediction.id}`} className="hover:underline">
                  {result ? signedPct(result.realizedReturn) : "—"}
                </Link>
              </Td>
              <Td align="right">
                <Link href={`/predictions/${prediction.id}`}>
                  <PointsCell points={points} />
                </Link>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}

export function PointsCell({ points }: { points: number | null }) {
  if (points === null) {
    return <span className="tnum text-fg-subtle">—</span>;
  }
  return (
    <span className={cn("tnum font-semibold", points > 0 ? "text-positive" : "text-fg-muted")}>
      {points}
    </span>
  );
}

export function Outcome({ prediction }: { prediction: ResolvedPrediction }) {
  if (!prediction.result) return <Badge tone="cyan">Open</Badge>;
  return prediction.result.hitTarget ? (
    <Badge tone="positive">Hit</Badge>
  ) : (
    <Badge tone="negative">Miss</Badge>
  );
}

/** Compact stacked rendering for narrow columns, used on the stock page. */
export function PredictionRowList({
  predictions,
  students,
}: {
  predictions: ResolvedPrediction[];
  students: Map<string, Student>;
}) {
  if (predictions.length === 0) {
    return <EmptyState title="No student picked this ticker in the selected cycle" />;
  }

  return (
    <ul className="divide-y divide-border">
      {predictions.map((prediction) => {
        const points = pointsForPick(prediction);
        return (
          <li key={prediction.id}>
            <Link
              href={`/predictions/${prediction.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {students.get(prediction.studentId)?.name ?? prediction.studentId}
                </p>
                <p className="font-mono text-[11px] text-fg-subtle">
                  {prediction.horizon} · {formatDate(prediction.resolutionDate)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "tnum text-sm font-medium",
                    prediction.result
                      ? returnTone(prediction.result.realizedReturn)
                      : "text-fg-subtle",
                  )}
                >
                  {prediction.result ? signedPct(prediction.result.realizedReturn) : "—"}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                  actual
                </p>
              </div>
              <div className="w-8 shrink-0 text-right">
                <PointsCell points={points} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
