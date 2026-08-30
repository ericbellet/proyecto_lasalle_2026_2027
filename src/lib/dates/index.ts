import { HORIZON_CALENDAR_DAYS, WEEKLY_LOCK, type Horizon } from "@/config/challenge";

/**
 * Date helpers.
 *
 * Everything here works on UTC calendar days. Market sessions are approximated
 * as "weekdays that are not a US market holiday"; that is accurate enough to
 * resolve a prediction on a day the exchange was actually open, which is the
 * only property the scoring depends on.
 */

const DAY_MS = 86_400_000;

/** Fixed-date and observed US market holidays for the seasons the course spans. */
const MARKET_HOLIDAYS = new Set<string>([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function isMarketDay(date: Date): boolean {
  return !isWeekend(date) && !MARKET_HOLIDAYS.has(toIsoDate(date));
}

/**
 * Nearest day the market was open. `direction` decides whether we walk forward
 * (resolution dates, which must not land before the horizon completes) or
 * backwards (entry prices, which must exist already).
 */
export function nearestMarketDay(date: Date, direction: 1 | -1 = 1): Date {
  let cursor = date;
  for (let step = 0; step < 10; step += 1) {
    if (isMarketDay(cursor)) return cursor;
    cursor = addDays(cursor, direction);
  }
  return cursor;
}

/**
 * When a prediction made on `predictionDate` becomes checkable.
 *
 * The MVP projects the horizon in calendar days and then snaps forward to the
 * next open session, so a 1W call made on a Monday resolves the following
 * Monday — or Tuesday when that Monday is a holiday.
 */
export function calculateResolutionDate(predictionDate: Date | string, horizon: Horizon): Date {
  const start = typeof predictionDate === "string" ? parseIsoDate(predictionDate) : predictionDate;
  const projected = addDays(start, HORIZON_CALENDAR_DAYS[horizon]);
  return nearestMarketDay(projected, 1);
}

/** Number of open sessions in `[from, to)`. Used for annualising volatility. */
export function countMarketDays(from: Date, to: Date): number {
  let count = 0;
  let cursor = from;
  while (cursor < to) {
    if (isMarketDay(cursor)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

/** ISO-8601 week number, the same numbering used by the cycle identifiers. */
export function isoWeek(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { year: target.getUTCFullYear(), week };
}

/** `2026-W07` — the canonical cycle identifier. */
export function cycleIdFor(date: Date): string {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Monday of the ISO week containing `date`. */
export function startOfIsoWeek(date: Date): Date {
  const dayNumber = (date.getUTCDay() + 6) % 7;
  return parseIsoDate(toIsoDate(addDays(date, -dayNumber)));
}

/** Sunday 21:59 UTC of the ISO week that contains `monday` (or any day in it). */
export function cycleDeadlineAt(monday: Date): Date {
  const deadline = addDays(startOfIsoWeek(monday), 6);
  deadline.setUTCHours(WEEKLY_LOCK.utcHour, WEEKLY_LOCK.utcMinute, 0, 0);
  return deadline;
}

export function formatDate(iso: string | Date, locale = "en-GB"): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatRelative(iso: string | Date, now = new Date()): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / DAY_MS);

  if (Math.abs(diffDays) >= 1) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffDays, "day");
  }
  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) >= 1) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffHours, "hour");
  }
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round(diffMs / 60_000),
    "minute",
  );
}
