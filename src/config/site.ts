import { env } from "@/lib/env";

/**
 * Identity of the platform. Everything user-visible that is not data lives here.
 */
export const site = {
  name: "LaSalle Investing",
  shortName: "LaSalle",
  tagline: "Can data, machine learning and AI agents consistently beat the market?",
  description:
    "La Salle university challenge where students build data lakes, machine learning models and AI agent systems, then compete on whether their stock picks reach +10%.",
  url: env.siteUrl,
  assets: { icon: "/icon.svg" },
} as const;
