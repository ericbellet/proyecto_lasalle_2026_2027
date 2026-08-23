import { toIsoDate } from "@/lib/dates";
import { mockDataset } from "@/lib/mock/dataset";
import type { MarketDataProvider, PriceQuote } from "@/lib/market-data/provider";

/**
 * Serves prices from the generated dataset. This is what MOCK_MODE resolves
 * predictions with, and it is also the provider the test suite uses, so a test
 * never depends on a network call.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  readonly name = "mock";

  private index: Map<string, Array<{ date: string; close: number }>> | null = null;

  private series(ticker: string) {
    if (!this.index) {
      const grouped = new Map<string, Array<{ date: string; close: number }>>();
      for (const row of mockDataset().prices) {
        const bucket = grouped.get(row.ticker) ?? [];
        bucket.push({ date: row.date, close: row.close });
        grouped.set(row.ticker, bucket);
      }
      for (const bucket of grouped.values()) bucket.sort((a, b) => a.date.localeCompare(b.date));
      this.index = grouped;
    }
    return this.index.get(ticker) ?? [];
  }

  async getQuote(ticker: string, date: Date): Promise<PriceQuote | null> {
    const target = toIsoDate(date);
    const series = this.series(ticker);

    let match: { date: string; close: number } | null = null;
    for (const row of series) {
      if (row.date > target) break;
      match = row;
    }
    if (!match) return null;

    return { ticker, date: match.date, close: match.close, source: this.name };
  }

  async getPrice(ticker: string, date: Date): Promise<number> {
    const quote = await this.getQuote(ticker, date);
    if (!quote) throw new Error(`No mock price for ${ticker} on ${toIsoDate(date)}`);
    return quote.close;
  }

  async getPrices(ticker: string, from: Date, to: Date): Promise<PriceQuote[]> {
    const start = toIsoDate(from);
    const end = toIsoDate(to);
    return this.series(ticker)
      .filter((row) => row.date >= start && row.date <= end)
      .map((row) => ({ ticker, date: row.date, close: row.close, source: this.name }));
  }
}
