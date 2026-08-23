import type { Metadata } from "next";
import { AlertTriangle, Lock } from "lucide-react";

import { CalibrationChart } from "@/components/charts/calibration-chart";
import {
  Badge,
  Meter,
  Panel,
  PanelHeader,
  SectionHeading,
  Stat,
} from "@/components/ui/primitives";
import {
  HORIZONS,
  HORIZON_CALENDAR_DAYS,
  HORIZON_LABELS,
  MAX_PREDICTIONS_PER_CYCLE,
  PICKS_PER_HORIZON,
  TARGET_RETURN,
} from "@/config/challenge";
import {
  LEADERBOARD_CONFIG,
  SCORE_COMPONENT_LABELS,
  SCORE_WEIGHTS,
  type ScoreComponent,
} from "@/config/leaderboard";
import { getCohortCalibration, getOverview } from "@/lib/data/queries";
import { pct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How predictions are recorded, resolved and scored — and the biases the design is built to avoid.",
};

const SCORE_EXPLANATIONS: Record<ScoreComponent, string> = {
  hitRate:
    "Share of resolved predictions that reached the target, normalised against the best and worst hit rates in the cohort.",
  calibration:
    "Brier skill score: how much better the stated probabilities are than always answering with the cohort's base rate. A student who says 90% and is right 90% of the time scores higher than one who says 90% and is right 60% of the time, even if both have the same hit rate.",
  relativeReturn:
    "Mean alpha — realized return minus the equal-weight benchmark over the same window — mapped onto the cohort's own distribution.",
  consistency:
    "Week-to-week stability, measured as dispersion beyond what binomial noise alone would produce. Penalises a record built on one spectacular cycle.",
  sampleReliability:
    "Grows with the number of resolved predictions and saturates at the threshold below. Stops a small, lucky sample from topping the board.",
};

const PITFALLS = [
  {
    title: "Look-ahead bias",
    body: "Using a fundamental value that was only published after the prediction date. The feature tables are dated for exactly this reason: a row is what was knowable on its snapshot date, nothing more.",
  },
  {
    title: "Data leakage",
    body: "Training on rows whose label depends on prices the model also saw as a feature. Split by time, never at random.",
  },
  {
    title: "Survivorship bias",
    body: "Backtesting on the companies that still exist today. The fixed universe here sidesteps it, but a student's own data lake will not be so forgiving.",
  },
  {
    title: "Overfitting",
    body: "A model with 40 features and 300 rows will fit the noise. Compare against the RA1 weighted baseline; if the complicated model cannot beat it out of sample, it has not earned its complexity.",
  },
  {
    title: "Cherry picking",
    body: "Reporting the best horizon or the best month. Every prediction ever submitted is scored here, which is why the platform snapshots rather than polls.",
  },
  {
    title: "Small samples",
    body: `Twelve predictions can look brilliant by chance. The board marks anyone below ${LEADERBOARD_CONFIG.minResolvedForRanking} resolved predictions as provisional and always shows n.`,
  },
  {
    title: "Market mechanics",
    body: "Splits, dividends, holidays and timezones all move a return by more than most model improvements do. Resolution dates snap to the next open session and prices are adjusted.",
  },
];

export default async function MethodologyPage() {
  const [{ bins, field }, overview] = await Promise.all([getCohortCalibration(), getOverview()]);

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="How this works"
        title="Methodology"
        description="The rules the platform enforces, the metrics it computes, and the reasons behind both."
      />

      <Panel className="border-accent/30 bg-accent-soft/40 p-5 sm:p-6">
        <p className="flex items-start gap-3 text-sm leading-relaxed">
          <Lock className="mt-0.5 size-4 shrink-0 text-accent-fg" />
          <span>
            <strong className="font-semibold">
              Every prediction is recorded before anyone knows the outcome.
            </strong>{" "}
            The platform pulls each student endpoint at the cycle deadline, validates the payload,
            stores the raw response with a content hash and locks it. From that moment the snapshot
            is the official prediction — changing the endpoint afterwards changes nothing.
          </span>
        </p>
      </Panel>

      <section>
        <SectionHeading
          eyebrow="The claim"
          title="What a prediction actually says"
          description="Not 'this stock will go up'. A prediction is a probability attached to a specific threshold and a specific deadline."
        />
        <Panel className="p-5 sm:p-6">
          <p className="text-pretty text-base leading-relaxed sm:text-lg">
            <span className="text-fg-muted">Given the information available today, my system
            estimates a</span>{" "}
            <span className="tnum font-semibold text-accent-fg">67%</span>{" "}
            <span className="text-fg-muted">probability that</span>{" "}
            <span className="tnum font-semibold">NVDA</span>{" "}
            <span className="text-fg-muted">reaches at least</span>{" "}
            <span className="tnum font-semibold text-positive">
              +{Math.round(TARGET_RETURN * 100)}%
            </span>{" "}
            <span className="text-fg-muted">within</span>{" "}
            <span className="font-semibold">3 months</span>
            <span className="text-fg-muted">.</span>
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-2.5 border-t border-border pt-5 sm:grid-cols-4">
            <Stat label="Target" value={`+${Math.round(TARGET_RETURN * 100)}%`} hint="Defines a hit" />
            <Stat label="Picks per horizon" value={PICKS_PER_HORIZON} hint="Top N shortlist" />
            <Stat
              label="Max per cycle"
              value={MAX_PREDICTIONS_PER_CYCLE}
              hint={`${HORIZONS.length} horizons`}
            />
            <Stat label="Cadence" value="Weekly" hint="Locked every Monday" />
          </dl>
        </Panel>
      </section>

      <section>
        <SectionHeading
          eyebrow="Timing"
          title="How predictions resolve"
          description="A single cycle produces four predictions that mature at four different times. The 6M calls from the first week of the course are still open when the last week's 1W calls have already been scored."
        />
        <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {HORIZONS.map((horizon) => (
            <li key={horizon} className="panel px-4 py-4">
              <Badge tone="accent">{horizon}</Badge>
              <p className="mt-2.5 text-sm font-medium">{HORIZON_LABELS[horizon]}</p>
              <p className="tnum mt-1 text-[11px] text-fg-muted">
                +{HORIZON_CALENDAR_DAYS[horizon]} calendar days, then forward to the next open
                session
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading
          eyebrow="Scoring"
          title="How the leaderboard score is built"
          description="Five components, each normalised to 0–1 against the cohort rather than an absolute bar, then weighted and scaled to 100."
        />
        <ul className="space-y-2.5">
          {(Object.keys(SCORE_WEIGHTS) as ScoreComponent[]).map((component) => (
            <li key={component} className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{SCORE_COMPONENT_LABELS[component]}</h3>
                <Badge tone="accent">{Math.round(SCORE_WEIGHTS[component] * 100)}%</Badge>
              </div>
              <Meter value={SCORE_WEIGHTS[component]} className="mt-2.5" />
              <p className="mt-2.5 text-xs leading-relaxed text-fg-muted">
                {SCORE_EXPLANATIONS[component]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading
          eyebrow="Probability quality"
          title="Cohort calibration"
          description="The competition scores how confident students were, not only what they picked. A model that says 90% and is right 60% of the time is worse than one that says 60% and is right 60% of the time."
        />
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Stated probability against observed frequency"
            description={`${overview.resolvedPredictions} resolved predictions · cohort hit rate ${pct(field.averageHitRate)}`}
          />
          <div className="p-4 sm:p-5">
            <CalibrationChart bins={bins} height={300} />
          </div>
        </Panel>
      </section>

      <section>
        <SectionHeading
          eyebrow="Warnings"
          title="What ruins a financial model"
          description="Most of these will cost more marks than a poorly tuned hyperparameter ever could."
        />
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {PITFALLS.map((pitfall) => (
            <li key={pitfall.title} className="panel flex gap-3 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <h3 className="text-sm font-semibold">{pitfall.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{pitfall.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
