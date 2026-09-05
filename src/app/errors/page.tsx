import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Panel,
  SectionHeading,
  Stat,
  TableShell,
  Td,
  Th,
} from "@/components/ui/primitives";
import type { QuerySource } from "@/lib/admin/query-attempts";
import { getQueryAttemptsPage } from "@/lib/data/query-attempts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Query errors",
  description: "Every student, influencer and market-price query, and whether it failed.",
};

const SOURCES: Array<{ id: "all" | QuerySource; label: string }> = [
  { id: "all", label: "All queries" },
  { id: "student_endpoint", label: "Students" },
  { id: "influencer_feed", label: "Influencer feed" },
  { id: "influencer_channel", label: "YouTube" },
  { id: "market_price", label: "Real prices" },
];

const SOURCE_LABEL: Record<QuerySource, string> = {
  student_endpoint: "Student",
  influencer_feed: "Feed",
  influencer_channel: "YouTube",
  market_price: "Real price",
};

function isSource(value: string | undefined): value is QuerySource {
  return (
    value === "student_endpoint" ||
    value === "influencer_feed" ||
    value === "influencer_channel" ||
    value === "market_price"
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; source?: string }>;
}) {
  const params = await searchParams;
  const failedOnly = params.view !== "all";
  const source = isSource(params.source) ? params.source : "all";
  const { attempts, summary, mock } = await getQueryAttemptsPage({ failedOnly, source });

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Operations"
        title="Query errors"
        description="Each time the platform asks a student endpoint, the influencer feed, or Yahoo for a real price, the result is stored here. Empty influencer weeks are not errors."
      />

      <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Logged" value={summary.total} hint={mock ? "mock sample" : "all attempts"} />
        <Stat label="Failed" value={summary.failed} hint="student + YouTube + prices" />
        <Stat label="Failed last 24h" value={summary.failedLast24h} hint="needs a retry" />
        <Stat
          label="Last query"
          value={summary.lastAttemptAt ? formatWhen(summary.lastAttemptAt) : "—"}
          hint="Europe/Madrid"
        />
      </dl>

      <div className="flex flex-wrap gap-2">
        <FilterLink href={href({ view: failedOnly ? undefined : "all", source })} active={failedOnly}>
          Failures
        </FilterLink>
        <FilterLink href={href({ view: "all", source })} active={!failedOnly}>
          All queries
        </FilterLink>
        <span className="mx-1 hidden h-8 w-px bg-border sm:block" aria-hidden />
        {SOURCES.map((item) => (
          <FilterLink
            key={item.id}
            href={href({ view: failedOnly ? undefined : "all", source: item.id })}
            active={source === item.id}
          >
            {item.label}
          </FilterLink>
        ))}
      </div>

      <Panel className="overflow-hidden">
        {attempts.length === 0 ? (
          <p className="px-4 py-8 text-sm text-fg-muted sm:px-6">
            No queries in this filter yet. The Sunday job and{" "}
            <Link href="/integrate" className="text-accent-fg underline-offset-4 hover:underline">
              Integration
            </Link>{" "}
            writes a row every time they pull an endpoint or a real price.
          </p>
        ) : (
          <TableShell minWidth={860}>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Query</Th>
                <Th>Status</Th>
                <Th>Error</Th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((row) => (
                <tr key={row.id} className={row.ok ? undefined : "bg-negative-soft/40"}>
                  <Td className="whitespace-nowrap font-mono text-[11px] text-fg-subtle">
                    {formatWhen(row.attemptedAt)}
                  </Td>
                  <Td>
                    <p className="text-xs font-medium">{row.subjectName}</p>
                    <p className="font-mono text-[11px] text-fg-subtle">
                      {row.ticker ?? row.url?.replace(/^https?:\/\//, "") ?? row.subjectId}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={row.kind === "market" ? "metal" : row.kind === "influencer" ? "cyan" : "neutral"}>
                      {SOURCE_LABEL[row.source]}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={row.ok ? "positive" : row.status === "timeout" ? "warning" : "negative"}>
                      {row.ok ? "ok" : row.status}
                    </Badge>
                    {row.httpStatus ? (
                      <span className="ml-2 font-mono text-[11px] text-fg-subtle">{row.httpStatus}</span>
                    ) : null}
                  </Td>
                  <Td className="max-w-sm text-xs leading-relaxed text-negative">
                    {row.errorMessage ?? (row.ok ? <span className="text-fg-subtle">—</span> : "Unknown error")}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

function href({ view, source }: { view?: string; source?: string }): string {
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  if (source && source !== "all") params.set("source", source);
  const query = params.toString();
  return query ? `/errors?${query}` : "/errors";
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 font-mono text-[10px] uppercase tracking-wider transition-colors",
        active
          ? "border-accent/40 bg-accent-soft text-accent-fg"
          : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}
