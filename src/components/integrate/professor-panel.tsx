"use client";

import { useState, type FormEvent } from "react";

import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";

const TOKEN_KEY = "lasalle-admin-token";

type RosterRow = {
  id: string;
  name: string;
  handle: string;
  kind?: "student" | "influencer";
  url: string;
  enabled: boolean;
  lastStatus: string;
  lastError: string | null;
  lastFetchAt: string | null;
  snapshotLocked: boolean;
  hasSnapshot: boolean;
};

function tokenHeader(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function ProfessorPanel({ mockMode }: { mockMode: boolean }) {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(TOKEN_KEY) ?? "";
  });
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [students, setStudents] = useState<RosterRow[]>([]);

  function persistToken(value: string) {
    setToken(value);
    if (typeof window !== "undefined") window.sessionStorage.setItem(TOKEN_KEY, value);
  }

  async function readError(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { error?: string };
      return body.error ?? response.statusText;
    } catch {
      return response.statusText;
    }
  }

  async function loadRoster() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/students", { headers: tokenHeader(token) });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = (await response.json()) as {
        cycleId: string;
        pendingStudentIds: string[];
        students: RosterRow[];
      };
      setCycleId(body.cycleId);
      setPending(body.pendingStudentIds);
      setStudents(body.students);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveEndpoint(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: tokenHeader(token),
        body: JSON.stringify({ name, url }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setMessage(`Saved ${name}. The Sunday job will pull this URL.`);
      setName("");
      setUrl("");
      await loadRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function retryFailed() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/retry-failed", {
        method: "POST",
        headers: tokenHeader(token),
        body: JSON.stringify(cycleId ? { cycleId } : {}),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = (await response.json()) as {
        summary: { stored: number; failed: number; attempted: number };
        pendingStudentIds: string[];
      };
      setMessage(
        `Retry stored ${body.summary.stored}/${body.summary.attempted}. Still pending: ${
          body.pendingStudentIds.join(", ") || "none"
        }.`,
      );
      await loadRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent";

  return (
    <Panel>
      <PanelHeader
        title="Professor — register endpoints"
        description="Students do not log in here. They host GET /api/predictions; you paste the URL. Gated by ADMIN_TOKEN."
      />
      <div className="space-y-4 px-4 py-4 sm:px-6">
        {mockMode ? (
          <p className="text-xs leading-relaxed text-warning">
            MOCK_MODE is on, so this form will not write. Set DATABASE_URL and MOCK_MODE=false on
            the live deployment, then register real Vercel URLs.
          </p>
        ) : null}

        <label className="block text-xs text-fg-muted">
          ADMIN_TOKEN
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => persistToken(event.target.value)}
            className={inputClass}
            placeholder="Bearer token from the Vercel env"
          />
        </label>

        <form onSubmit={saveEndpoint} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-fg-muted">
            Student name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="Laura García"
            />
          </label>
          <label className="block text-xs text-fg-muted">
            Predictions URL
            <input
              required
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={inputClass}
              placeholder="https://lgarcia-investing.vercel.app/api/predictions"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy || !token}>
              Save endpoint
            </Button>
            <Button type="button" size="sm" disabled={busy || !token} onClick={() => void loadRoster()}>
              Load roster
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !token || pending.length === 0}
              onClick={() => void retryFailed()}
            >
              Retry failed ({pending.length})
            </Button>
          </div>
        </form>

        {error ? <p className="text-xs text-negative">{error}</p> : null}
        {message ? <p className="text-xs text-fg-muted">{message}</p> : null}

        {students.length > 0 ? (
          <ul className="space-y-2">
            {students.map((student) => (
              <li
                key={student.id}
                className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-fg">
                    {student.name}
                    {student.kind === "influencer" ? (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                        influencer
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate font-mono text-[11px] text-fg-subtle">{student.url}</p>
                  {student.lastError ? (
                    <p className="mt-1 text-[11px] text-negative">{student.lastError}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Badge tone={student.snapshotLocked ? "positive" : student.hasSnapshot ? "warning" : "neutral"}>
                    {student.snapshotLocked ? "locked" : student.hasSnapshot ? "unlocked" : "missing"}
                  </Badge>
                  <Badge
                    tone={
                      student.lastStatus === "healthy"
                        ? "positive"
                        : student.lastStatus === "unknown"
                          ? "neutral"
                          : "negative"
                    }
                  >
                    {student.lastStatus}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}
