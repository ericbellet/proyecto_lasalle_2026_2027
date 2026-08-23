import { env } from "@/lib/env";

/**
 * Identity of the platform. Everything user-visible that is not data lives here.
 */
export const site = {
  name: "Value Investing Challenge",
  shortName: "VIC",
  tagline: "Can data, machine learning and AI agents consistently beat the market?",
  description:
    "A university challenge where students build data lakes, machine learning models and AI agent systems, then compete on the accuracy and calibration of their stock predictions.",
  url: env.siteUrl,
  assets: { icon: "/icon.svg" },
} as const;

export const NAV_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/students", label: "Students" },
  { href: "/stocks", label: "Stocks" },
  { href: "/consensus", label: "Consensus" },
  { href: "/history", label: "History" },
  { href: "/methodology", label: "Methodology" },
] as const;
