"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PredictionSnapshot } from "@/lib/types";

/**
 * Raw response viewer.
 *
 * When a student disputes a score the first question is always "what exactly did
 * my endpoint return that Monday", and this is the answer: the verbatim body,
 * with the hash that proves it has not been edited since.
 */
export function PayloadInspector({
  snapshots,
  names,
}: {
  snapshots: PredictionSnapshot[];
  names: Record<string, string>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (snapshots.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-fg-subtle sm:px-6">
        No snapshots recorded for this cycle yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {snapshots.map((snapshot) => {
        const open = openId === snapshot.id;
        return (
          <li key={snapshot.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : snapshot.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover sm:px-6"
            >
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-fg-subtle transition-transform",
                  open && "rotate-180",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {names[snapshot.studentId] ?? snapshot.studentId}
                </p>
                <p className="truncate font-mono text-[10px] text-fg-subtle">
                  {snapshot.payloadHash.slice(0, 16)} ·{" "}
                  {snapshot.lockedAt ? "locked" : "unlocked"}
                </p>
              </div>
            </button>

            {open ? (
              <pre className="scroll-x mx-4 mb-3 max-h-96 overflow-y-auto rounded-md border border-border bg-bg p-3 font-mono text-[11px] leading-relaxed text-fg-muted sm:mx-6">
                {JSON.stringify(snapshot.rawPayload, null, 2)}
              </pre>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
