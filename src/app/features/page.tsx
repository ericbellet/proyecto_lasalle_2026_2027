import type { Metadata } from "next";

import { FeatureExplorer } from "@/components/features/feature-explorer";
import { Badge, Panel, SectionHeading } from "@/components/ui/primitives";
import { FEATURE_CATALOG, INFLUENCER_SOURCES, featuresInStoreCount } from "@/lib/features/catalog";

export const metadata: Metadata = {
  title: "Features",
  description: "Variables students can use to decide — including influencer analysis.",
};

export default async function FeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  const inStore = featuresInStoreCount();

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Inspiration"
        title="Feature catalog"
        description="A menu, not a homework list. Pick what you can build point-in-time. Twenty honest features beat forty leaked ones. Official board points stay one per stock that reaches +10% — these numbers feed your model, not the public score."
      />

      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Stat label="Listed" value={FEATURE_CATALOG.length} hint="from the notes + the store" />
        <Stat label="In STOCK_FEATURES" value={inStore} hint="already in the teaching row" />
        <Stat label="Build yourself" value={FEATURE_CATALOG.length - inStore} hint="including influencers" />
      </dl>

      <section id="influencers" className="space-y-4">
        <SectionHeading
          eyebrow="New family"
          title="Search influencers, then score what they said"
          description="Treat a YouTuber, a FinTwit account or a famous 13F the same way you treat ROIC: a dated input. If the clip went out after your snapshot, you are cheating."
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel className="p-4 sm:p-5">
            <p className="text-sm font-semibold">How it enters your score</p>
            <p className="mt-2 text-xs leading-relaxed text-fg-muted">
              For each account you follow, store ticker, stance (−1 / 0 / +1), and{" "}
              <span className="font-mono text-[11px] text-fg">published_at</span>. Keep only posts
              with <span className="font-mono text-[11px] text-fg">published_at ≤ snapshot_date</span>.
              Then:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-bg-elevated px-3 py-2.5 font-mono text-[11px] leading-relaxed text-accent-fg">
              {`influencer_i = stance × recency × account_weight
your_score   = baseline + λ · influencer_i`}
            </pre>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-fg-muted">
              <li>
                <Badge tone="metal" className="mr-1.5">
                  λ
                </Badge>
                Start small (0.05–0.15). If influencers dominate the baseline, you no longer have a
                fundamental model.
              </li>
              <li>
                Recency: a clip from yesterday should weigh more than one from six months ago — except
                on 6M picks, where a durable thesis matters more than a hot take.
              </li>
              <li>
                Crowd warning: if mention count is high and the stock already ran, the idea is late.
                Use mention count as a contrary feature, not as confirmation.
              </li>
            </ul>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-border px-4 py-3 sm:px-5">
              <p className="text-sm font-semibold">Where to look</p>
              <p className="mt-1 text-xs text-fg-muted">
                Starter sources from the course notes. You choose the accounts; the platform does not
                scrape them for you.
              </p>
            </div>
            <ul className="divide-y divide-border">
              {INFLUENCER_SOURCES.map((source) => (
                <li key={source.name} className="px-4 py-3 sm:px-5">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-accent-fg hover:underline"
                  >
                    {source.name}
                  </a>
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">{source.use}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Catalog"
          title="Every variable on the menu"
          description={`Rows tagged “in store” already exist on the teaching STOCK_FEATURES row. “Build it” means you extract it. You are not required to use all ${FEATURE_CATALOG.length}.`}
        />
        <FeatureExplorer initialGroup={group} />
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="panel px-4 py-3.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
      <p className="tnum mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>
    </div>
  );
}
