import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";

import { CodeBlock } from "@/components/ui/code-block";
import {
  Badge,
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
  TARGET_RETURN,
} from "@/config/challenge";
import { EXAMPLE_PAYLOAD } from "@/lib/validation/student-contract";

export const metadata: Metadata = {
  title: "Connect your model",
  description: "The API contract every student endpoint must satisfy, with working examples.",
};

const FIELDS = [
  ["student_id", "string", "yes", "The id the professor assigned you. Must match exactly."],
  ["model_version", "string", "yes", "Free-form, e.g. v1, v2.3, agents-v3. Used to track your evolution."],
  ["model_name", "string", "no", "Human label shown on the leaderboard, e.g. 'XGBoost multi-horizon'."],
  ["generated_at", "ISO 8601", "yes", "When your system produced these predictions. Must include a timezone offset."],
  ["predictions[].ticker", "string", "yes", "Uppercase symbol from the challenge universe."],
  ["predictions[].horizon", HORIZONS.join(" | "), "yes", "Which horizon this pick belongs to."],
  ["predictions[].rank", `1–${PICKS_PER_HORIZON}`, "yes", "Your ordering within that horizon. No duplicates."],
  ["predictions[].probability", "0–1", "yes", `Probability of reaching +${Math.round(TARGET_RETURN * 100)}% inside the horizon.`],
  ["predictions[].expected_return", "-1–10", "yes", "Your point estimate as a decimal: 0.14 means +14%."],
  ["predictions[].target_price", "number", "no", "Price you expect at the horizon."],
  ["predictions[].investment_thesis", "string", "no", "Up to 2000 characters. Shown on the prediction page."],
  ["predictions[].risks", "string", "no", "Up to 2000 characters. What would make you wrong."],
] as const;

const PYTHON_EXAMPLE = `# FastAPI — deploy anywhere that gives you a public HTTPS URL
from datetime import datetime, timezone
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/predictions")
def predictions():
    picks = my_model.top_picks()  # your RA1/RA2/RA3 system

    return {
        "student_id": "student-01",
        "model_version": "v2",
        "model_name": "XGBoost multi-horizon",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "predictions": [
            {
                "ticker": p.ticker,
                "horizon": p.horizon,          # "1W" | "1M" | "3M" | "6M"
                "rank": p.rank,                # 1, 2 or 3
                "probability": round(p.probability, 4),
                "expected_return": round(p.expected_return, 4),
            }
            for p in picks
        ],
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "model_version": "v2"}`;

const NEXT_EXAMPLE = `// app/api/predictions/route.ts — Next.js on Vercel
import { NextResponse } from "next/server";

export const revalidate = 0; // never serve a cached shortlist

export async function GET() {
  const picks = await topPicks();

  return NextResponse.json({
    student_id: "student-01",
    model_version: "v3",
    model_name: "Investment committee",
    generated_at: new Date().toISOString(),
    predictions: picks.map((pick) => ({
      ticker: pick.ticker,
      horizon: pick.horizon,
      rank: pick.rank,
      probability: pick.probability,
      expected_return: pick.expectedReturn,
    })),
  });
}`;

const CHECKLIST = [
  { ok: true, text: "Endpoint answers a plain GET with no authentication, or with a key you gave the professor." },
  { ok: true, text: "Responds in under 8 seconds. Precompute your shortlist; do not train a model inside the request." },
  { ok: true, text: `At most ${MAX_PREDICTIONS_PER_CYCLE} predictions: ${PICKS_PER_HORIZON} per horizon.` },
  { ok: true, text: "Probabilities are decimals between 0 and 1, not percentages." },
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
      />

      <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {[
          "Deploy your system somewhere with a public HTTPS URL.",
          "Implement GET /api/predictions.",
          "Return the JSON schema below.",
          "Send the professor your base URL.",
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
          <strong className="font-semibold">Your endpoint is polled, then frozen.</strong> At each
          cycle deadline the platform fetches your shortlist once, hashes the raw response and locks
          it. Editing your endpoint afterwards has no effect on predictions already recorded — which
          is the whole point.
        </p>
      </Panel>
    </div>
  );
}
