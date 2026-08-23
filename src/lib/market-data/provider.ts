/**
 * Market data is behind an interface so the platform never depends on one
 * vendor's uptime, rate limit or pricing. Swapping providers is an env change.
 */

export interface PriceQuote {
  ticker: string;
  /** The session actually used, which may differ from the requested day. */
  date: string;
  close: number;
  source: string;
}

export interface MarketDataProvider {
  readonly name: string;
  getPrice(ticker: string, date: Date): Promise<number>;
  getQuote(ticker: string, date: Date): Promise<PriceQuote | null>;
  getPrices(ticker: string, from: Date, to: Date): Promise<PriceQuote[]>;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly ticker: string,
    readonly provider: string,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}
