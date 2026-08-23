import { addDays, isMarketDay, parseIsoDate, toIsoDate } from "@/lib/dates";
import { Rng, round } from "@/lib/mock/random";
import { STOCK_UNIVERSE, type StockProfile } from "@/lib/mock/universe";
import type { MarketPrice } from "@/lib/types";

/**
 * Synthetic price history.
 *
 * Prices follow a geometric Brownian motion driven by a shared market factor
 * plus an idiosyncratic term, so correlations between names are believable and
 * a "risk-off" week shows up across the whole board rather than one ticker.
 */

const TRADING_DAYS_PER_YEAR = 252;

/** Annualised volatility of the shared market factor. */
const MARKET_VOLATILITY = 0.16;

export interface PriceSeries {
  /** Ordered trading days, ISO date strings. */
  dates: string[];
  /** ticker -> close price per index in `dates`. */
  closes: Map<string, number[]>;
  /** ticker -> date -> index, for O(1) lookups. */
  index: Map<string, number>;
  /** Equal-weight benchmark index, one value per trading day. */
  benchmark: number[];
  rows: MarketPrice[];
}

export function tradingCalendar(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = parseIsoDate(from);
  const end = parseIsoDate(to);
  while (cursor <= end) {
    if (isMarketDay(cursor)) dates.push(toIsoDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function buildPriceSeries(from: string, to: string, seed: string): PriceSeries {
  const dates = tradingCalendar(from, to);
  const index = new Map<string, number>(dates.map((date, position) => [date, position]));
  const marketRng = new Rng(`${seed}:market`);

  // Shared market factor. Zero mean by construction — each ticker carries its
  // own drift — with an AR(1) volatility regime so calm and turbulent stretches
  // cluster the way they do in real markets. Letting the regime move the *mean*
  // instead would compound into an enormous unintended trend over 400 sessions.
  const marketVolDaily = MARKET_VOLATILITY / Math.sqrt(TRADING_DAYS_PER_YEAR);
  const marketDaily: number[] = [];
  let volRegime = 0;
  for (let day = 0; day < dates.length; day += 1) {
    volRegime = volRegime * 0.94 + marketRng.normal(0, 0.35);
    const multiplier = Math.exp(Math.max(-0.8, Math.min(1.2, volRegime)) * 0.45);
    marketDaily.push(marketRng.normal(0, marketVolDaily * multiplier));
  }

  const closes = new Map<string, number[]>();
  const rows: MarketPrice[] = [];

  for (const profile of STOCK_UNIVERSE) {
    const rng = new Rng(`${seed}:${profile.ticker}`);
    // Split the target volatility into the part explained by the market factor
    // and an idiosyncratic remainder, so total variance lands on the profile.
    const idioVol = Math.sqrt(
      Math.max(profile.volatility ** 2 - (profile.beta * MARKET_VOLATILITY) ** 2, 0.06 ** 2),
    );
    // Itô correction, applied once here so realised growth matches `drift`.
    const dailyDrift =
      (profile.drift - profile.volatility ** 2 / 2) / TRADING_DAYS_PER_YEAR;
    const dailyIdio = idioVol / Math.sqrt(TRADING_DAYS_PER_YEAR);

    const series: number[] = [];
    let price = profile.startPrice;

    for (let day = 0; day < dates.length; day += 1) {
      const date = dates[day] as string;
      const marketComponent = profile.beta * (marketDaily[day] as number);
      const logReturn = dailyDrift + marketComponent + rng.normal(0, dailyIdio);

      const previousClose = price;
      price = price * Math.exp(logReturn);

      const intradayRange = Math.abs(rng.normal(0, dailyIdio)) * price;
      const open = round(previousClose * (1 + rng.normal(0, dailyIdio * 0.4)), 2);
      const high = round(Math.max(open, price) + intradayRange * 0.6, 2);
      const low = round(Math.max(Math.min(open, price) - intradayRange * 0.6, 0.5), 2);
      const close = round(price, 2);

      series.push(close);
      rows.push({
        ticker: profile.ticker,
        date,
        open,
        high,
        low,
        close,
        adjustedClose: close,
        volume: Math.round(baseVolume(profile) * (1 + rng.normal(0, 0.28))),
      });
    }

    closes.set(profile.ticker, series);
  }

  // Equal-weight benchmark rebased to 1000 on the first session.
  const benchmark: number[] = [];
  for (let day = 0; day < dates.length; day += 1) {
    const total = STOCK_UNIVERSE.reduce((acc, profile) => {
      const series = closes.get(profile.ticker) as number[];
      return acc + (series[day] as number) / profile.startPrice;
    }, 0);
    benchmark.push(round((total / STOCK_UNIVERSE.length) * 1000, 2));
  }

  return { dates, closes, index, benchmark, rows };
}

function baseVolume(profile: StockProfile): number {
  // Rough inverse relationship between price and share turnover.
  return Math.round((profile.marketCap / profile.startPrice) * 0.0016);
}

/** Close on `date`, or the most recent session before it. */
export function closeOnOrBefore(series: PriceSeries, ticker: string, date: string): number | null {
  const prices = series.closes.get(ticker);
  if (!prices) return null;

  const exact = series.index.get(date);
  if (exact !== undefined) return prices[exact] ?? null;

  let position = -1;
  for (let i = 0; i < series.dates.length; i += 1) {
    if ((series.dates[i] as string) > date) break;
    position = i;
  }
  return position >= 0 ? (prices[position] ?? null) : null;
}

export function benchmarkOnOrBefore(series: PriceSeries, date: string): number | null {
  const exact = series.index.get(date);
  if (exact !== undefined) return series.benchmark[exact] ?? null;

  let position = -1;
  for (let i = 0; i < series.dates.length; i += 1) {
    if ((series.dates[i] as string) > date) break;
    position = i;
  }
  return position >= 0 ? (series.benchmark[position] ?? null) : null;
}

export function returnOver(
  series: PriceSeries,
  ticker: string,
  fromDate: string,
  toDate: string,
): number | null {
  const from = closeOnOrBefore(series, ticker, fromDate);
  const to = closeOnOrBefore(series, ticker, toDate);
  if (from === null || to === null || from === 0) return null;
  return to / from - 1;
}

/** Trailing window statistics computed strictly from data up to `date`. */
export function trailingStats(series: PriceSeries, ticker: string, date: string) {
  const prices = series.closes.get(ticker);
  const end = series.index.get(date);
  if (!prices || end === undefined) return null;

  const at = (offset: number) => prices[Math.max(end - offset, 0)] as number;
  const current = prices[end] as number;

  const window = (days: number) => prices.slice(Math.max(end - days + 1, 0), end + 1);

  const logReturns = (days: number) => {
    const slice = window(days + 1);
    const out: number[] = [];
    for (let i = 1; i < slice.length; i += 1) {
      out.push(Math.log((slice[i] as number) / (slice[i - 1] as number)));
    }
    return out;
  };

  const annualisedVol = (days: number) => {
    const returns = logReturns(days);
    if (returns.length < 2) return 0;
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, r) => acc + (r - avg) ** 2, 0) / (returns.length - 1);
    return Math.sqrt(variance * TRADING_DAYS_PER_YEAR);
  };

  const yearWindow = window(TRADING_DAYS_PER_YEAR);
  const high52 = Math.max(...yearWindow);
  const low52 = Math.min(...yearWindow);

  return {
    close: current,
    return1d: current / at(1) - 1,
    return1w: current / at(5) - 1,
    return1m: current / at(21) - 1,
    return3m: current / at(63) - 1,
    return6m: current / at(126) - 1,
    volatility30d: annualisedVol(21),
    volatility90d: annualisedVol(63),
    drawdown: current / high52 - 1,
    distance52wHigh: current / high52 - 1,
    distance52wLow: current / low52 - 1,
  };
}

/**
 * Analytic P(return >= target) over `days`, assuming the ticker's own drift and
 * volatility. This is the honest base rate a well-calibrated student should be
 * converging towards — it uses no information from the future.
 */
export function baseRateProbability(profile: StockProfile, days: number, target: number): number {
  const years = days / 365;
  const mean = (profile.drift - profile.volatility ** 2 / 2) * years;
  const sd = profile.volatility * Math.sqrt(years);
  if (sd === 0) return 0;
  const z = (Math.log(1 + target) - mean) / sd;
  return 1 - normalCdf(z);
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Abramowitz & Stegun 7.1.26 — accurate to ~1.5e-7, plenty for synthetic data. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absX);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-absX * absX);
  return sign * y;
}
