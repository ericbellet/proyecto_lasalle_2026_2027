import { describe, expect, it } from "vitest";

import {
  influencerToStudentPayload,
  validateInfluencerFeed,
} from "@/lib/validation/influencer-contract";

const feed = {
  generated_at: "2026-09-06T12:00:00Z",
  influencers: [
    {
      name: "La Pizarra de Andrés",
      handle: "lapizarradeandres",
      generated_at: "2026-09-06T10:00:00Z",
      predictions: [{
        ticker: "AAPL",
        horizon: "3M" as const,
        rank: 1,
        source_url: "https://www.youtube.com/watch?v=abcdefghijk",
      }],
    },
    {
      name: "Arte de Invertir",
      handle: "artedeinvertir",
      generated_at: "2026-09-06T10:00:00Z",
      predictions: [],
    },
  ],
};

describe("validateInfluencerFeed", () => {
  it("accepts N people and allows empty predictions", () => {
    const result = validateInfluencerFeed(feed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feed.influencers).toHaveLength(2);
    expect(result.feed.influencers[1]?.predictions).toEqual([]);
  });

  it("maps a person with picks onto the student snapshot shape", () => {
    const payload = influencerToStudentPayload(feed.influencers[0]!);
    expect(payload?.student).toBe("La Pizarra de Andrés");
    expect(payload?.predictions[0]?.ticker).toBe("AAPL");
    expect(payload?.predictions[0]?.source_url).toContain("youtube.com/watch");
  });

  it("does not invent a student payload when the video had no picks", () => {
    expect(influencerToStudentPayload(feed.influencers[1]!)).toBeNull();
  });

  it("accepts a per-channel error and refuses to store that week", () => {
    const result = validateInfluencerFeed({
      generated_at: "2026-09-06T12:00:00Z",
      error: "One or more YouTube channel queries failed",
      influencers: [
        {
          name: "Arte de Invertir",
          handle: "artedeinvertir",
          generated_at: "2026-09-06T10:00:00Z",
          predictions: [{ ticker: "AAPL", horizon: "1W", rank: 1 }],
          error: "YouTube RSS 503",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feed.error).toContain("YouTube");
    expect(influencerToStudentPayload(result.feed.influencers[0]!)).toBeNull();
  });
});
