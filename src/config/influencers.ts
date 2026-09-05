import type { StudentConfig } from "@/config/students";
import { env } from "@/lib/env";

/**
 * YouTube (and later other) influencers scored next to the class.
 *
 * They are not registered one URL each. The Sunday job fetches
 * `INFLUENCER_FEED_URL` once and expands the JSON into these people.
 */
export const INFLUENCERS: StudentConfig[] = [
  {
    id: "inf-lapizarra-de-andres",
    name: "La Pizarra de Andrés",
    handle: "lapizarradeandres",
    kind: "influencer",
    api: {
      baseUrl: influencerFeedOrigin(),
      predictions: "/api/influencers",
      health: "/api/health",
    },
    enabled: true,
  },
  {
    id: "inf-arte-de-invertir",
    name: "Arte de Invertir",
    handle: "artedeinvertir",
    kind: "influencer",
    api: {
      baseUrl: influencerFeedOrigin(),
      predictions: "/api/influencers",
      health: "/api/health",
    },
    enabled: true,
  },
  {
    id: "inf-jose-luis-cava",
    name: "José Luis Cava",
    handle: "joseluiscavatv",
    kind: "influencer",
    api: {
      baseUrl: influencerFeedOrigin(),
      predictions: "/api/influencers",
      health: "/api/health",
    },
    enabled: true,
  },
  {
    id: "inf-graham-stephan",
    name: "Graham Stephan",
    handle: "grahamstephan",
    kind: "influencer",
    api: {
      baseUrl: influencerFeedOrigin(),
      predictions: "/api/influencers",
      health: "/api/health",
    },
    enabled: true,
  },
  {
    id: "inf-invertir-desde-cero",
    name: "Invertir desde Cero",
    handle: "invertirdesdecero",
    kind: "influencer",
    api: {
      baseUrl: influencerFeedOrigin(),
      predictions: "/api/influencers",
      health: "/api/health",
    },
    enabled: true,
  },
];

function influencerFeedOrigin(): string {
  try {
    return new URL(env.influencerFeedUrl).origin;
  } catch {
    return "https://influencer-predictions.vercel.app";
  }
}

export function influencerFeedUrl(): string {
  return env.influencerFeedUrl;
}

export function isInfluencer(person: { kind?: string; id?: string }): boolean {
  return person.kind === "influencer" || Boolean(person.id?.startsWith("inf-"));
}
