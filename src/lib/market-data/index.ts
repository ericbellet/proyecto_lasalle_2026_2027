import { env } from "@/lib/env";
import { MockMarketDataProvider } from "@/lib/market-data/mock-provider";
import type { MarketDataProvider } from "@/lib/market-data/provider";
import { YahooFinanceProvider } from "@/lib/market-data/yahoo-provider";

export * from "@/lib/market-data/provider";
export { MockMarketDataProvider } from "@/lib/market-data/mock-provider";
export { YahooFinanceProvider } from "@/lib/market-data/yahoo-provider";

let instance: MarketDataProvider | null = null;

/**
 * The provider the running app should use.
 *
 * Adding a vendor means writing one class and one case here — nothing else in
 * the codebase knows where prices come from.
 */
export function marketDataProvider(): MarketDataProvider {
  if (instance) return instance;

  switch (env.marketDataProvider) {
    case "yahoo":
      instance = new YahooFinanceProvider();
      break;
    default:
      instance = new MockMarketDataProvider();
  }

  return instance;
}
