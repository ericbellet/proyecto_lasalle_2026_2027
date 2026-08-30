import {
  DEFAULT_WINDOW,
  HORIZONS,
  HORIZON_LABELS,
  LEADERBOARD_WINDOWS,
  RESEARCH_AREAS,
  type Horizon,
  type LeaderboardWindowId,
  type ResearchArea,
} from "@/config/challenge";
import type { AreaFilter, HorizonFilter } from "@/lib/data/queries";

/**
 * Search-param parsing for the filtered views.
 *
 * Filters live in the URL rather than in client state, so every one of these
 * needs to survive a hand-typed or stale query string. Each parser falls back to
 * the default instead of throwing.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Flattens Next's `string | string[]` into the plain map `FilterPills` wants. */
export function flatten(params: RawSearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    out[key] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}

export function parseHorizon(value: string | undefined): HorizonFilter {
  return HORIZONS.includes(value as Horizon) ? (value as Horizon) : "OVERALL";
}

export function parseOptionalId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseWindow(
  value: string | undefined,
  fallback: LeaderboardWindowId = DEFAULT_WINDOW,
): LeaderboardWindowId {
  return LEADERBOARD_WINDOWS.some((window) => window.id === value)
    ? (value as LeaderboardWindowId)
    : fallback;
}

export function parseArea(value: string | undefined): AreaFilter {
  return RESEARCH_AREAS.includes(value as ResearchArea) ? (value as ResearchArea) : "ALL";
}

export const HORIZON_OPTIONS = [
  { value: "OVERALL", label: "Overall" },
  ...HORIZONS.map((horizon) => ({ value: horizon, label: HORIZON_LABELS[horizon] })),
] as const;

export const WINDOW_OPTIONS = LEADERBOARD_WINDOWS.map((window) => ({
  value: window.id,
  label: window.label,
}));

export const AREA_OPTIONS = [
  { value: "ALL", label: "All models" },
  ...RESEARCH_AREAS.map((area) => ({ value: area, label: area })),
] as const;
