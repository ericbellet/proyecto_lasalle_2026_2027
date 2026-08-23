"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface Operation {
  id: string;
  label: string;
  description: string;
  path: string;
  body?: Record<string, unknown>;
  danger?: boolean;
}

interface RunState {
  status: "idle" | "running" | "ok" | "error";
  message?: string;
  detail?: unknown;
}

/**
 * The professor's control panel.
 *
 * The admin token is typed here and sent as a bearer header on each request. It
 * is never written to storage — a refresh clears it — because this UI is used a
 * handful of times a week and persisting a write credential in `localStorage`
 * buys convenience at a price the rest of the design refuses to pay elsewhere.
 */
export function OperationsPanel({ currentCycleId }: { currentCycleId: string }) {
  const [token, setToken] = useState("");
  const [cycleId, setCycleId] = useState(currentCycleId);
  const [runs, setRuns] = useState<Record<string, RunState>>({});

  const operations: Operation[] = [
    {
      id: "create-cycle",
      label: "Create cycle",
      description: "Opens the prediction cycle for the current ISO week.",
      path: "/api/admin/cycles",
    },
    {
      id: "fetch-all",
      label: "Fetch all students",
      description: "Pulls every enabled endpoint, validates and snapshots.",
      path: "/api/admin/fetch-all",
      body: { cycleId },
    },
    {
      id: "lock-cycle",
      label: "Lock cycle",
      description: "Freezes the snapshots. Irreversible by design.",
      path: "/api/admin/lock-cycle",
      body: { cycleId },
      danger: true,
    },
    {
      id: "resolve",
      label: "Resolve due predictions",
      description: "Prices every prediction whose horizon has elapsed.",
      path: "/api/admin/resolve",
    },
    {
      id: "recalculate",
      label: "Recalculate leaderboard",
      description: "Stores the standings snapshot for this cycle.",
      path: "/api/admin/recalculate",
      body: { cycleId },
    },
  ];

  async function run(operation: Operation) {
    setRuns((current) => ({ ...current, [operation.id]: { status: "running" } }));

    try {
      const response = await fetch(operation.path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(operation.body ?? {}),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        [key: string]: unknown;
      };

      setRuns((current) => ({
        ...current,
        [operation.id]: {
          status: response.ok && data.ok ? "ok" : "error",
          message: data.message ?? data.error ?? `HTTP ${response.status}`,
          detail: data.results ?? data.summary ?? undefined,
        },
      }));
    } catch (error) {
      setRuns((current) => ({
        ...current,
        [operation.id]: {
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Operations"
        description="Each action is authenticated with the shared admin token and written to the audit log."
      />

      <div className="grid grid-cols-1 gap-3 border-b border-border px-4 py-4 sm:grid-cols-2 sm:px-6">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            Admin token
          </span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="ADMIN_TOKEN"
            autoComplete="off"
            className="mt-1.5 h-9 w-full rounded-md border border-border-strong bg-bg px-3 font-mono text-xs text-fg outline-none placeholder:text-fg-subtle focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            Target cycle
          </span>
          <input
            value={cycleId}
            onChange={(event) => setCycleId(event.target.value)}
            className="tnum mt-1.5 h-9 w-full rounded-md border border-border-strong bg-bg px-3 text-xs text-fg outline-none focus:border-accent"
          />
        </label>
      </div>

      <ul className="divide-y divide-border">
        {operations.map((operation) => {
          const state = runs[operation.id] ?? { status: "idle" as const };
          return (
            <li key={operation.id} className="px-4 py-3.5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{operation.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
                    {operation.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={operation.danger ? "danger" : "secondary"}
                  disabled={!token || state.status === "running"}
                  onClick={() => run(operation)}
                  className="shrink-0"
                >
                  {state.status === "running" ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Running
                    </>
                  ) : (
                    "Run"
                  )}
                </Button>
              </div>

              {state.status === "ok" || state.status === "error" ? (
                <div
                  className={cn(
                    "mt-3 flex items-start gap-2 rounded-md border px-3 py-2",
                    state.status === "ok"
                      ? "border-positive/25 bg-positive-soft"
                      : "border-negative/25 bg-negative-soft",
                  )}
                >
                  {state.status === "ok" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-positive" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-negative" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] leading-relaxed">{state.message}</p>
                    {state.detail ? (
                      <pre className="scroll-x mt-2 max-h-40 overflow-y-auto rounded border border-border bg-bg p-2 font-mono text-[10px] text-fg-muted">
                        {JSON.stringify(state.detail, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {!token ? (
        <p className="border-t border-border px-4 py-3 text-[11px] text-fg-subtle sm:px-6">
          Enter the admin token to enable these actions.{" "}
          <Badge tone="neutral">not stored</Badge>
        </p>
      ) : null}
    </Panel>
  );
}
