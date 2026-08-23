import Link from "next/link";

import { Badge, EmptyState, Td, Th, TableShell } from "@/components/ui/primitives";
import { TARGET_RETURN } from "@/config/challenge";
import type { ResolvedPrediction, Student } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { cn, pct, returnTone, signedPct } from "@/lib/utils";

/**
 * A list of predictions with their outcomes.
 *
 * `show` controls whether the left-hand identity column is the student or the
 * ticker, because the same table is used on the student page (many tickers, one
 * student) and the stock page (many students, one ticker).
 */
export function PredictionsTable({
  predictions,
  show = "ticker",
  students,
  emptyTitle = "No predictions here",
  emptyDescription,
}: {
  predictions: ResolvedPrediction[];
  show?: "ticker" | "student";
  students?: Map<string, Student>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (predictions.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <TableShell minWidth={820}>
      <thead>
        <tr>
          <Th>{show === "ticker" ? "Stock" : "Student"}</Th>
          <Th>Horizon</Th>
          <Th align="right">Rank</Th>
          <Th align="right">Probability</Th>
          <Th align="right">Expected</Th>
          <Th align="right">Realized</Th>
          <Th align="right">Alpha</Th>
          <Th align="right">Resolves</Th>
          <Th align="right">Outcome</Th>
        </tr>
      </thead>
      <tbody>
        {predictions.map((prediction) => {
          const result = prediction.result;
          const student = students?.get(prediction.studentId);

          return (
            <tr key={prediction.id} className="transition-colors hover:bg-surface-hover">
              <Td>
                <Link
                  href={
                    show === "ticker"
                      ? `/stocks/${prediction.ticker}`
                      : `/students/${prediction.studentId}`
                  }
                  className="font-medium hover:text-accent-fg"
                >
                  {show === "ticker"
                    ? prediction.ticker
                    : (student?.name ?? prediction.studentId)}
                </Link>
              </Td>
              <Td>
                <span className="font-mono text-[11px] text-fg-muted">{prediction.horizon}</span>
              </Td>
              <Td align="right" className="tnum text-fg-subtle">
                #{prediction.rank}
              </Td>
              <Td align="right" className="tnum font-medium">
                {pct(prediction.probability, 0)}
              </Td>
              <Td align="right" className="tnum text-fg-muted">
                {signedPct(prediction.expectedReturn)}
              </Td>
              <Td
                align="right"
                className={cn("tnum", result ? returnTone(result.realizedReturn) : "text-fg-subtle")}
              >
                {result ? signedPct(result.realizedReturn) : "—"}
              </Td>
              <Td
                align="right"
                className={cn("tnum", result ? returnTone(result.alpha) : "text-fg-subtle")}
              >
                {result ? signedPct(result.alpha) : "—"}
              </Td>
              <Td align="right" className="tnum whitespace-nowrap text-xs text-fg-muted">
                {formatDate(prediction.resolutionDate)}
              </Td>
              <Td align="right">
                <Link href={`/predictions/${prediction.id}`}>
                  <Outcome prediction={prediction} />
                </Link>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}

export function Outcome({ prediction }: { prediction: ResolvedPrediction }) {
  if (!prediction.result) return <Badge tone="cyan">Active</Badge>;
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
      {predictions.map((prediction) => (
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
                {prediction.horizon} · rank {prediction.rank} · target +
                {Math.round(TARGET_RETURN * 100)}%
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum text-sm font-medium">{pct(prediction.probability, 0)}</p>
              <p
                className={cn(
                  "tnum text-[11px]",
                  prediction.result ? returnTone(prediction.result.realizedReturn) : "text-fg-subtle",
                )}
              >
                {prediction.result ? signedPct(prediction.result.realizedReturn) : "active"}
              </p>
            </div>
            <Outcome prediction={prediction} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
