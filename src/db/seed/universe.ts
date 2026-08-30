import { db, schema } from "@/db";
import { STOCK_UNIVERSE, toStock } from "@/lib/mock/universe";

/**
 * Upserts the ten-ticker teaching universe. Does not touch students or picks.
 */
async function main() {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_PASSWORD) {
    throw new Error("DATABASE_URL or SUPABASE_DB_PASSWORD is required.");
  }

  const rows = STOCK_UNIVERSE.map(toStock);
  const client = db();
  for (const stock of rows) {
    await client
      .insert(schema.stocks)
      .values(stock)
      .onConflictDoUpdate({
        target: schema.stocks.ticker,
        set: {
          companyName: stock.companyName,
          sector: stock.sector,
          industry: stock.industry,
          country: stock.country,
          marketCap: stock.marketCap,
          employees: stock.employees,
          peerGroup: stock.peerGroup,
        },
      });
  }
  console.log(`Upserted ${rows.length} stocks.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
