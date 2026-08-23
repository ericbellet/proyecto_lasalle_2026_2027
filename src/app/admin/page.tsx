import type { Metadata } from "next";
import { AlertTriangle, Database, FlaskConical } from "lucide-react";

import { OperationsPanel } from "@/components/admin/operations-panel";
import { PayloadInspector } from "@/components/admin/payload-inspector";
import { InsightList } from "@/components/common/insight-list";
import { DotMatrix } from "@/components/ui/dot-matrix";
import {
  Badge,
  Panel,
  PanelHeader,
  SectionHeading,
  Stat,
  Td,
  Th,
  TableShell,
} from "@/components/ui/primitives";
import { getDataset } from "@/lib/data/dataset";
import { getInsights, getIntegrations, getOverview } from "@/lib/data/queries";
import { formatDate, formatRelative } from "@/lib/dates";
import { env } from "@/lib/env";
import type { IntegrationStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin",
  description: "Cycle operations, student integrations and raw payload inspection.",
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<IntegrationStatus, "positive" | "negative" | "warning" | "neutral"> = {
  healthy: "positive",
  error: "negative",
  timeout: "warning",
  invalid: "warning",
  unknown: "neutral",
};

export default async function AdminPage() {
  const [overview, integrations, insights, dataset] = await Promise.all([
    getOverview(),
    getIntegrations(),
    getInsights(),
    getDataset(),
  ]);

  const cycleSnapshots = dataset.snapshots.filter(
    (snapshot) => snapshot.cycleId === overview.currentCycle.id,
  );
  const names = Object.fromEntries(dataset.students.map((student) => [student.id, student.name]));
  const healthy = integrations.filter((row) => row.lastStatus === "healthy").length;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Professor"
        title="Admin"
        description="Everything that writes to the platform happens here: opening a cycle, pulling the cohort, locking the snapshots, resolving matured predictions."
      />

      {env.mockMode ? (
        <Panel className="flex items-start gap-3 border-warning/30 bg-warning-soft/30 p-4 sm:p-5">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium">Running in mock mode</p>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              Everything on this deployment comes from the deterministic generated dataset — sixteen
              students, ten stocks, {overview.totalCycles} cycles. The operations below are wired to
              the real endpoints but will refuse to run without a database. Set{" "}
              <code className="font-mono text-fg">DATABASE_URL</code> and{" "}
              <code className="font-mono text-fg">MOCK_MODE=false</code> to go live.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel className="flex items-start gap-3 border-positive/25 bg-positive-soft/30 p-4 sm:p-5">
          <Database className="mt-0.5 size-4 shrink-0 text-positive" />
          <div>
            <p className="text-sm font-medium">Connected to PostgreSQL</p>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              Write operations are live. Market data provider:{" "}
              <code className="font-mono text-fg">{env.marketDataProvider}</code>.
            </p>
          </div>
        </Panel>
      )}

      <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat
          label="Current cycle"
          value={overview.currentCycle.id}
          hint={`Deadline ${formatDate(overview.currentCycle.deadlineAt)}`}
        />
        <Stat
          label="Snapshots"
          value={cycleSnapshots.length}
          hint={`${cycleSnapshots.filter((snapshot) => snapshot.lockedAt).length} locked`}
        />
        <Stat
          label="Endpoints healthy"
          value={`${healthy}/${integrations.length}`}
          hint="Last fetch result"
        />
        <Stat
          label="Awaiting resolution"
          value={overview.activePredictions}
          hint="Horizon has not elapsed"
        />
      </dl>

      <OperationsPanel currentCycleId={overview.currentCycle.id} />

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Student integrations"
          description="One row per registered endpoint. A failure here is a student problem, not a platform problem — the error text is what they need to see."
          action={
            <div className="flex items-center gap-2">
              <DotMatrix count={integrations.length} columns={8} />
              <span className="font-mono text-[10px] text-fg-subtle">
                {integrations.length} tracked
              </span>
            </div>
          }
        />
        <TableShell minWidth={840}>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>Endpoint</Th>
              <Th>Status</Th>
              <Th align="right">Latency</Th>
              <Th align="right">Last fetch</Th>
              <Th>Error</Th>
            </tr>
          </thead>
          <tbody>
            {integrations.map((integration) => (
              <tr key={integration.studentId} className="transition-colors hover:bg-surface-hover">
                <Td className="whitespace-nowrap text-xs font-medium">
                  {integration.student?.name ?? integration.studentId}
                </Td>
                <Td className="max-w-[280px]">
                  <span className="block truncate font-mono text-[11px] text-fg-muted">
                    {integration.baseUrl.replace(/^https?:\/\//, "")}
                    {integration.predictionsEndpoint}
                  </span>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[integration.lastStatus]}>{integration.lastStatus}</Badge>
                  {!integration.enabled ? (
                    <Badge tone="neutral" className="ml-1.5">
                      disabled
                    </Badge>
                  ) : null}
                </Td>
                <Td align="right" className="tnum text-xs text-fg-muted">
                  {integration.lastLatencyMs === null ? "—" : `${integration.lastLatencyMs} ms`}
                </Td>
                <Td align="right" className="whitespace-nowrap text-xs text-fg-muted">
                  {integration.lastFetchAt ? formatRelative(integration.lastFetchAt) : "never"}
                </Td>
                <Td className="max-w-[240px]">
                  {integration.lastError ? (
                    <span className="block truncate text-[11px] text-negative" title={integration.lastError}>
                      {integration.lastError}
                    </span>
                  ) : (
                    <span className="text-[11px] text-fg-subtle">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Raw payloads"
          description={`Exactly what each endpoint returned for ${overview.currentCycle.id}, with the content hash recorded at fetch time.`}
        />
        <PayloadInspector snapshots={cycleSnapshots} names={names} />
      </Panel>

      {insights.length > 0 ? (
        <section>
          <SectionHeading
            eyebrow="Automatic analysis"
            title="What to mention in class"
            description="Rule-based, computed from resolved predictions."
          />
          <InsightList insights={insights} />
        </section>
      ) : null}

      <Panel className="flex items-start gap-3 p-4 sm:p-5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
        <p className="text-[11px] leading-relaxed text-fg-subtle">
          Locking is deliberately one-way. If a snapshot genuinely has to change — a student
          endpoint returned garbage because of a platform bug, say — the correction goes in as a new
          audit-logged entry rather than an edit, so the record of what happened survives the fix.
        </p>
      </Panel>
    </div>
  );
}
