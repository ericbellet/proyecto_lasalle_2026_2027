import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";

import { ProfessorPanel } from "@/components/integrate/professor-panel";
import { CodeBlock } from "@/components/ui/code-block";
import {
  Badge,
  LinkButton,
  Panel,
  PanelHeader,
  SectionHeading,
  Td,
  Th,
  TableShell,
} from "@/components/ui/primitives";
import {
  HORIZONS,
  MAX_PREDICTIONS_PER_CYCLE,
  PICKS_PER_HORIZON,
} from "@/config/challenge";
import { EXAMPLE_PAYLOAD } from "@/lib/validation/student-contract";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Connect your model",
  description: "The API contract every student endpoint must satisfy, with working examples.",
};

const FIELDS = [
  ["student", "string", "yes", "Your name, as registered by the professor. Accents and extra spaces are ignored."],
  ["generated_at", "ISO 8601", "yes", "When your system produced these predictions. Must include a timezone offset."],
  ["predictions[].ticker", "string", "yes", "Uppercase symbol from the challenge universe."],
  ["predictions[].horizon", HORIZONS.join(" | "), "yes", "Which horizon this pick belongs to."],
  ["predictions[].rank", `1–${PICKS_PER_HORIZON}`, "yes", "Your ordering within that horizon. No duplicates."],
  ["predictions[].target_price", "number", "no", "Price you expect at the horizon."],
  ["predictions[].investment_thesis", "string", "no", "Up to 2000 characters. Shown on the prediction page."],
  ["predictions[].risks", "string", "no", "Up to 2000 characters. What would make you wrong."],
  ["error", "string", "no", "If your query failed (Yahoo, your model, a timeout), return it here. The professor Errors page stores it. Do not invent tickers to hide the failure."],
] as const;

const PYTHON_EXAMPLE = `# FastAPI — deploy anywhere that gives you a public HTTPS URL
from datetime import datetime, timezone
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/predictions")
def predictions():
    picks = my_model.top_picks()  # your RA1/RA2/RA3 system

    return {
        "student": "Laura García",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "predictions": [
            {
                "ticker": p.ticker,
                "horizon": p.horizon,          # "1W" | "1M" | "3M" | "6M"
                "rank": p.rank,                # 1, 2 or 3
            }
            for p in picks
        ],
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}`;

const NEXT_EXAMPLE = `// app/api/predictions/route.ts — Next.js on Vercel
import { NextResponse } from "next/server";

export const revalidate = 0; // never serve a cached shortlist

export async function GET() {
  const picks = await topPicks();

  return NextResponse.json({
    student: "Laura García",
    generated_at: new Date().toISOString(),
    predictions: picks.map((pick) => ({
      ticker: pick.ticker,
      horizon: pick.horizon,
      rank: pick.rank,
    })),
  });
}`;

const CHECKLIST = [
  { ok: true, text: "Endpoint answers a plain GET with no authentication, or with a key you gave the professor." },
  { ok: true, text: "Responds in under 8 seconds. Precompute your shortlist; do not train a model inside the request." },
  { ok: true, text: `At most ${MAX_PREDICTIONS_PER_CYCLE} predictions: ${PICKS_PER_HORIZON} per horizon.` },
  { ok: false, text: "Do not return a different shortlist on every request — the platform snapshots once and locks it." },
  { ok: false, text: "Do not rank two tickers the same inside one horizon; the payload is rejected outright." },
  { ok: false, text: "Do not put an API key in a query string. Send it in a header and tell the professor the env var name." },
];

export default function IntegratePage() {
  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="For students"
        title="Connect your model"
        description="You build the data lake, the warehouse, the models and the agents. The only thing this platform needs from you is one URL that returns JSON."
        action={
          <LinkButton href="/features" variant="secondary" size="sm">
            Feature catalog
          </LinkButton>
        }
      />

      <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {[
          "Copy the class template with Copier (or deploy any public HTTPS URL).",
          "Implement GET /api/predictions — start from the dummy shortlist, then plug in your model.",
          "Return the JSON schema below. student must match the roster name.",
          "Send the professor your base URL — they register it; you do not log in here.",
          "Watch yourself appear on the leaderboard.",
        ].map((step, index) => (
          <li key={step} className="panel flex gap-3 p-4">
            <span className="grid size-6 shrink-0 place-items-center rounded-md border border-accent/35 bg-accent-soft font-mono text-[11px] font-semibold text-accent-fg">
              {index + 1}
            </span>
            <p className="text-xs leading-relaxed text-fg-muted">{step}</p>
          </li>
        ))}
      </ol>

      <section>
        <SectionHeading
          eyebrow="Contract"
          title="The response shape"
          description="Validated with Zod on arrival. A payload that fails validation is never stored and never scored — you will see the exact error in the integrations panel."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <CodeBlock label="GET /api/predictions" code={JSON.stringify(EXAMPLE_PAYLOAD, null, 2)} />
          <Panel className="overflow-hidden">
            <PanelHeader title="Fields" description="Everything the validator checks." />
            <TableShell minWidth={520}>
              <thead>
                <tr>
                  <Th>Field</Th>
                  <Th>Type</Th>
                  <Th>Required</Th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(([name, type, required, note]) => (
                  <tr key={name}>
                    <Td className="font-mono text-[11px]">{name}</Td>
                    <Td className="font-mono text-[11px] text-fg-muted">{type}</Td>
                    <Td>
                      {required === "yes" ? (
                        <Badge tone="accent">required</Badge>
                      ) : (
                        <Badge tone="neutral">optional</Badge>
                      )}
                      <span className="mt-1 block text-[11px] leading-snug text-fg-muted">
                        {note}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </Panel>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Template"
          title="Copy the dummy, then make it yours"
          description="The live Eric Bellet API is the example. Copier asks for your name, Next.js or FastAPI, and 12 starting tickers. Do not deploy that repo unchanged — the student field would still say Eric Bellet."
        />
        <CodeBlock
          label="uvx copier"
          code={`uvx copier copy gh:ericbellet/eric-bellet-predictions ./my-predictions
cd my-predictions
# Next.js:  npm install && npm run dev && npx vercel
# FastAPI:  uv sync && uv run uvicorn app:app --reload`}
        />
      </section>

      <section>
        <SectionHeading eyebrow="Examples" title="Two working endpoints" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CodeBlock label="Python · FastAPI" code={PYTHON_EXAMPLE} />
          <CodeBlock label="TypeScript · Next.js" code={NEXT_EXAMPLE} />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Before you send the URL"
          title="Checklist"
          description="Most integration failures are one of these seven things."
        />
        <ul className="space-y-2">
          {CHECKLIST.map((item) => (
            <li key={item.text} className="panel flex items-start gap-3 p-3.5">
              {item.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-negative" />
              )}
              <p className="text-xs leading-relaxed text-fg-muted">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <Panel className="border-warning/30 bg-warning-soft/30 p-5">
        <p className="text-sm leading-relaxed">
          <strong className="font-semibold">Your endpoint is polled, then frozen.</strong> Every
          Sunday at 23:59 Europe/Madrid the platform fetches your shortlist, hashes the raw
          response and locks that student&apos;s snapshot. Editing your endpoint afterwards has no
          effect on predictions already recorded — which is the whole point.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          If your URL is down that night, the other students are still locked. The professor can
          retry only the failed endpoints (three attempts with backoff during the job, then{" "}
          <code className="font-mono text-[11px]">POST /api/admin/retry-failed</code>) without
          unlocking anyone else. Waiting until next Sunday is too late for that week&apos;s 1W
          picks.
        </p>
      </Panel>

      <section>
        <SectionHeading
          eyebrow="For the professor"
          title="Register each student URL"
          description="Students host GET /api/predictions on Vercel (or anywhere HTTPS). You store the URL here. The Sunday cron pulls it."
        />
        <ProfessorPanel mockMode={env.mockMode} />
      </section>
    </div>
  );
}
