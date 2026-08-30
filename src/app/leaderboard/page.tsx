import type { Metadata } from "next";

import { PickBoard } from "@/components/leaderboard/pick-board";
import { PickFilters } from "@/components/leaderboard/pick-filters";
import { Podium } from "@/components/leaderboard/podium";
import { LinkButton, Panel, SectionHeading } from "@/components/ui/primitives";
import { PICKS_PER_HORIZON, TARGET_RETURN } from "@/config/challenge";
import {
  getLeaderboard,
  getPickBoard,
  getPickFilterOptions,
} from "@/lib/data/queries";
import {
  flatten,
  parseHorizon,
  parseOptionalId,
  type RawSearchParams,
} from "@/lib/data/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "One row per pick. Points are awarded when the deadline arrives.",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = flatten(await searchParams);
  const horizon = parseHorizon(raw.horizon);
  const studentId = parseOptionalId(raw.student);
  const ticker = parseOptionalId(raw.stock);
  const deadline = parseOptionalId(raw.deadline);
  const filtered = Boolean(studentId || ticker || deadline || horizon !== "OVERALL");

  const [entries, picks, options] = await Promise.all([
    getLeaderboard(),
    getPickBoard({
      horizon,
      studentId,
      ticker,
      deadline,
      window: filtered ? "all-time" : "this-week",
    }),
    getPickFilterOptions(),
  ]);

  const ranked = entries.filter((entry) => !entry.provisional);

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="grid-bg pointer-events-none absolute -inset-x-4 -top-10 h-72 sm:-inset-x-6" />
        <SectionHeading
          eyebrow="Season"
          title="LaSalle Investing"
          titleClassName="text-metal-gradient"
          description={`One point when a stock reaches +${Math.round(TARGET_RETURN * 100)}% at the deadline. Until that date, Actual and Pts stay blank. Three picks per horizon, 0–${PICKS_PER_HORIZON} points on that horizon.`}
          action={
            <LinkButton href="/integrate" variant="primary" size="sm">
              Integration
            </LinkButton>
          }
        />
        <Podium entries={ranked.slice(0, 3)} />
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <PickFilters
            students={options.students}
            tickers={options.tickers}
            deadlines={options.deadlines}
            current={{
              student: studentId ?? "",
              stock: ticker ?? "",
              deadline: deadline ?? "",
              horizon,
            }}
          />
        </div>
        <PickBoard
          rows={picks.map((row) => ({
            id: row.prediction.id,
            studentId: row.student.id,
            studentName: row.student.name,
            ticker: row.prediction.ticker,
            horizon: row.prediction.horizon,
            deadline: row.prediction.resolutionDate,
            actual: row.prediction.result?.realizedReturn ?? null,
            points: row.points,
          }))}
        />
      </Panel>
    </div>
  );
}
