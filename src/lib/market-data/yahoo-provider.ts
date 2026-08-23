import { addDays, toIsoDate } from "@/lib/dates";
import { MarketDataError, type MarketDataProvider, type PriceQuote } from "@/lib/market-data/provider";

/**
 * Yahoo Finance chart endpoint.
 *
 * Free and keyless, which is why it is the default real provider, but it is an
 * undocumented endpoint that can change or rate-limit without notice. Treat a
 * failure here as "resolve later", never as "the prediction missed".
 */

const ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { adjclose?: Array<{ adjclose?: Array<number | null> }>; quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: { description?: string } | null;
  };
}

export class YahooFinanceProvider implements MarketDataProvider {
  readonly name = "yahoo";

  constructor(private readonly timeoutMs = 10_000) {}

  async getPrices(ticker: string, from: Date, to: Date): Promise<PriceQuote[]> {
    const period1 = Math.floor(from.getTime() / 1000);
    // Yahoo's range is exclusive on the upper bound.
    const period2 = Math.floor(addDays(to, 1).getTime() / 1000);
    const url = `${ENDPOINT}/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "value-investing-challenge/1.0" },
        next: { revalidate: 3600 },
      });
      if (!response.ok) {
        throw new MarketDataError(`HTTP ${response.status}`, ticker, this.name);
      }

      const body = (await response.json()) as YahooChartResponse;
      const result = body.chart?.result?.[0];
      if (!result?.timestamp) return [];

      const closes =
        result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? [];

      return result.timestamp
        .map((seconds, index) => ({
          ticker,
          date: toIsoDate(new Date(seconds * 1000)),
          close: closes[index] ?? null,
          source: this.name,
        }))
        .filter((quote): quote is PriceQuote => quote.close !== null);
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new MarketDataError(reason, ticker, this.name);
    } finally {
      clearTimeout(timer);
    }
  }

  async getQuote(ticker: string, date: Date): Promise<PriceQuote | null> {
    // A ten-day lookback covers weekends plus the longest market holiday run.
    const quotes = await this.getPrices(ticker, addDays(date, -10), date);
    return quotes.length ? (quotes[quotes.length - 1] as PriceQuote) : null;
  }

  async getPrice(ticker: string, date: Date): Promise<number> {
    const quote = await this.getQuote(ticker, date);
    if (!quote) throw new MarketDataError(`No price on or before ${toIsoDate(date)}`, ticker, this.name);
    return quote.close;
  }
}
