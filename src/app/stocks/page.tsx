import type { Metadata } from "next";
import Link from "next/link";

import {
  Explain,
  Meter,
  Panel,
  PanelHeader,
  SectionHeading,
  Td,
  Th,
  TableShell,
} from "@/components/ui/primitives";
import { getStocks } from "@/lib/data/queries";
import { cn, compactNumber, money, num, pct, returnTone, signedPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Stocks",
  description: "The ten-company universe every student picks from, with the current cohort view.",
};

export default async function StocksPage() {
  const stocks = await getStocks();
  const maxSelections = Math.max(1, ...stocks.map((stock) => stock.selections));

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Universe"
        title="Stocks"
        description="A fixed ten-company universe. Keeping it fixed removes survivorship bias from the competition and makes two students' results directly comparable."
      />

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Universe overview"
          description="Fundamentals are the values as of the most recent snapshot date."
        />
        <TableShell minWidth={900}>
          <thead>
            <tr>
              <Th>Ticker</Th>
              <Th>Sector</Th>
              <Th align="right">Price</Th>
              <Th align="right">
                <Explain term="Baseline">
                  The reference weighted score shipped with the teaching dataset. Students are expected to replace these weights with their own and justify them.
                </Explain>
              </Th>
              <Th align="right">P/E</Th>
              <Th align="right">Rev. growth</Th>
              <Th align="right">ROIC</Th>
              <Th align="right">Mom. 3M</Th>
              <Th align="right">Picked by</Th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.ticker} className="transition-colors hover:bg-surface-hover">
                <Td>
                  <Link href={`/stocks/${stock.ticker}`} className="group block">
                    <span className="tnum text-sm font-semibold transition-colors group-hover:text-accent-fg">
                      {stock.ticker}
                    </span>
                    <span className="ml-2 hidden text-xs text-fg-muted lg:inline">
                      {stock.companyName}
                    </span>
                  </Link>
                </Td>
                <Td className="text-xs text-fg-muted">{stock.sector}</Td>
                <Td align="right" className="tnum">
                  {money(stock.latest?.close)}
                </Td>
                <Td align="right" className="tnum font-medium">
                  {num(stock.latest?.baselineInvestmentScore, 1)}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {num(stock.latest?.peRatio, 1)}
                </Td>
                <Td
                  align="right"
                  className={cn("tnum", returnTone(stock.latest?.revenueGrowthYoy))}
                >
                  {signedPct(stock.latest?.revenueGrowthYoy)}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {pct(stock.latest?.roic)}
                </Td>
                <Td align="right" className={cn("tnum", returnTone(stock.latest?.momentum3m))}>
                  {signedPct(stock.latest?.momentum3m)}
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="tnum text-xs text-fg-muted">{stock.selections}</span>
                    <Meter
                      value={stock.selections / maxSelections}
                      className="w-12"
                      tone={stock.selections === maxSelections ? "metal" : "accent"}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Panel>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stocks.map((stock) => (
          <li key={stock.ticker}>
            <Link
              href={`/stocks/${stock.ticker}`}
              className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-panel)] transition-colors hover:border-border-strong hover:bg-surface-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="tnum text-base font-semibold">{stock.ticker}</p>
                  <p className="truncate text-xs text-fg-muted">{stock.companyName}</p>
                </div>
                <p className="tnum shrink-0 text-sm">{money(stock.latest?.close)}</p>
              </div>
              <p className="text-[11px] leading-snug text-fg-subtle">
                {stock.sector} · {stock.industry} · {compactNumber(stock.marketCap)} market cap
              </p>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-[11px] text-fg-muted">
                  {stock.selections} student{stock.selections === 1 ? "" : "s"} this cycle
                </span>
                <span className="tnum text-[11px] font-medium">
                  {stock.selections > 0 ? pct(stock.averageProbability, 0) : "—"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
