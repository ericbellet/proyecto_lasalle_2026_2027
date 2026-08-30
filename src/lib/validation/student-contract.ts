import { z } from "zod";
import { HORIZONS, PICKS_PER_HORIZON, type Horizon } from "@/config/challenge";

/**
 * The contract every student endpoint must satisfy.
 *
 * This schema is the single authority: if a payload does not parse here, it is
 * never stored, never scored and never shown on the leaderboard. Students get
 * the exact error message back through the admin integrations panel.
 */

const tickerSchema = z
  .string()
  .trim()
  .min(1, "ticker is required")
  .max(10, "ticker must be at most 10 characters")
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z][A-Z0-9.\-]*$/, "ticker must look like a stock symbol"));

export const predictionItemSchema = z.object({
  ticker: tickerSchema,
  horizon: z.enum(HORIZONS),
  rank: z.number().int().min(1).max(PICKS_PER_HORIZON),
  target_price: z.number().positive().nullish(),
  investment_thesis: z.string().max(2000).nullish(),
  risks: z.string().max(2000).nullish(),
});

export type StudentPredictionItem = z.infer<typeof predictionItemSchema>;

/** Fold accents and spacing so "Sofía Ramírez" matches "Sofia  Ramirez". */
export function normaliseStudentName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function studentNamesMatch(declared: string, registered: string): boolean {
  return normaliseStudentName(declared) === normaliseStudentName(registered);
}

export const studentPayloadSchema = z
  .object({
    student: z.string().trim().min(1).max(120),
    generated_at: z.string().datetime({ offset: true }),
    predictions: z.array(predictionItemSchema).min(1).max(HORIZONS.length * PICKS_PER_HORIZON),
  })
  .superRefine((payload, ctx) => {
    const seenRanks = new Map<Horizon, Set<number>>();
    const seenPicks = new Map<Horizon, Set<string>>();

    for (const [index, prediction] of payload.predictions.entries()) {
      const ranks = seenRanks.get(prediction.horizon) ?? new Set<number>();
      const picks = seenPicks.get(prediction.horizon) ?? new Set<string>();

      if (ranks.has(prediction.rank)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["predictions", index, "rank"],
          message: `duplicate rank ${prediction.rank} for horizon ${prediction.horizon}`,
        });
      }
      if (picks.has(prediction.ticker)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["predictions", index, "ticker"],
          message: `${prediction.ticker} appears twice in horizon ${prediction.horizon}`,
        });
      }

      ranks.add(prediction.rank);
      picks.add(prediction.ticker);
      seenRanks.set(prediction.horizon, ranks);
      seenPicks.set(prediction.horizon, picks);
    }
  });

export type StudentPayload = z.infer<typeof studentPayloadSchema>;

export interface ContractIssue {
  path: string;
  message: string;
}

export type ContractResult =
  | { ok: true; payload: StudentPayload }
  | { ok: false; issues: ContractIssue[] };

export function validateStudentPayload(input: unknown): ContractResult {
  const parsed = studentPayloadSchema.safeParse(input);
  if (parsed.success) return { ok: true, payload: parsed.data };

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join(".") : "(root)",
      message: issue.message,
    })),
  };
}

/** A short human sentence for the admin table, built from the first few issues. */
export function summariseIssues(issues: ContractIssue[]): string {
  const head = issues
    .slice(0, 3)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join(" · ");
  return issues.length > 3 ? `${head} (+${issues.length - 3} more)` : head;
}

/** Example payload rendered in the docs and in the integration panel. */
export const EXAMPLE_PAYLOAD: StudentPayload = {
  student: "Laura García",
  generated_at: "2026-09-14T12:00:00Z",
  predictions: [
    { ticker: "META", horizon: "1W", rank: 1 },
    { ticker: "NVDA", horizon: "1W", rank: 2 },
    { ticker: "AAPL", horizon: "1W", rank: 3 },
  ],
};
