import { z } from "zod";

import { predictionItemSchema, studentPayloadSchema, type StudentPayload } from "@/lib/validation/student-contract";

/**
 * Exception to the student contract: one HTTPS resource returns N people.
 * Each person reuses the same pick shape. Empty predictions are allowed —
 * a week without a stock video is not a failed week.
 */
export const influencerItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  handle: z.string().trim().min(1).max(80).optional(),
  source: z.string().trim().max(40).optional(),
  channel_url: z.string().url().optional(),
  generated_at: z.string().datetime({ offset: true }),
  predictions: z.array(predictionItemSchema).max(12),
  error: z.string().trim().max(2000).nullish(),
});

export const influencerFeedSchema = z.object({
  generated_at: z.string().datetime({ offset: true }),
  error: z.string().trim().max(2000).nullish(),
  influencers: z.array(influencerItemSchema).min(1).max(40),
});

export type InfluencerItem = z.infer<typeof influencerItemSchema>;
export type InfluencerFeed = z.infer<typeof influencerFeedSchema>;

export type FeedResult =
  | { ok: true; feed: InfluencerFeed }
  | { ok: false; issues: Array<{ path: string; message: string }> };

export function validateInfluencerFeed(input: unknown): FeedResult {
  const parsed = influencerFeedSchema.safeParse(input);
  if (parsed.success) return { ok: true, feed: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join(".") : "(root)",
      message: issue.message,
    })),
  };
}

/** Reuse the student snapshot writer when the influencer actually has picks. */
export function influencerToStudentPayload(item: InfluencerItem): StudentPayload | null {
  if (item.error) return null;
  if (item.predictions.length === 0) return null;
  const parsed = studentPayloadSchema.safeParse({
    student: item.name,
    generated_at: item.generated_at,
    predictions: item.predictions,
  });
  return parsed.success ? parsed.data : null;
}
