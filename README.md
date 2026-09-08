# LaSalle Investing

A university competition where students build data lakes, machine learning models and AI agent systems — and this platform scores whether their stock predictions actually beat the market.

Students do **not** build this website. They build the systems behind `GET /api/predictions`. The professor platform pulls those endpoints, freezes the payload, waits for reality, and publishes a leaderboard.

> **Every prediction must be recorded before we know the outcome.**

```
STUDENT SYSTEMS
       ↓
Student APIs
       ↓
Professor Fetcher
       ↓
Validation (Zod)
       ↓
Immutable Snapshots
       ↓
Central PostgreSQL
       ↓
Market Resolver
       ↓
Metrics Engine
       ↓
Leaderboard
       ↓
Web UI
```

## Project purpose

The course has three research areas. Each one produces a new model generation. Old results are never overwritten.

| Generation | Project | What the student builds |
| --- | --- | --- |
| `v1` | RA1 — Market Data Lake | Ingestion, Spark, Parquet/Delta, hand-weighted baseline score |
| `v2` | RA2 — Warehouse & ML | Airflow, PostgreSQL warehouse, point-in-time features, classifiers |
| `v3` | RA3 — AI Agents | Tools over the warehouse, specialised agents, investment committee |

The question the semester is designed to answer:

> Did ML beat the manual score? Did agents beat ML?

## Architecture

The app is a single Next.js 15 project.

- **UI** — App Router pages for home, leaderboard, students, stocks, consensus, history, predictions, methodology, integrate, admin.
- **Scoring** — Pure TypeScript in `src/lib/metrics`. Same functions run in mock mode, in the seed, and in tests.
- **Student pull** — `src/lib/student-api/fetcher.ts` fetches endpoints with bounded concurrency and per-student timeouts.
- **Snapshots** — Once `locked_at` is set, a snapshot cannot be overwritten.
- **Market data** — `MarketDataProvider` interface. Mock by default, Yahoo ready.
- **Database** — Optional. `MOCK_MODE=true` (the default) serves a deterministic in-memory season so `npm run dev` is enough.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the mermaid diagram and table list.

## Student integration contract

Each student deploys any HTTPS endpoint and sends the professor a URL. The fastest start is the Copier template in the dummy repo:

```bash
uvx copier copy gh:ericbellet/eric-bellet-predictions ./my-predictions
```

See [docs/STUDENT_INTEGRATION.md](docs/STUDENT_INTEGRATION.md).

```http
GET /api/predictions
```

```json
{
  "student": "Laura García",
  "generated_at": "2026-09-14T12:00:00Z",
  "predictions": [
    {
      "ticker": "META",
      "horizon": "1W",
      "rank": 1
    }
  ]
}
```

Rules: max 12 picks (top 3 × 4 horizons), unique rank per horizon, `generated_at` with a timezone offset. The `student` field is the person's name, matching the roster. Invalid payloads are rejected entirely.

Full walkthrough: [docs/STUDENT_INTEGRATION.md](docs/STUDENT_INTEGRATION.md).

Influencers are the exception. The platform fetches **one** feed (`INFLUENCER_FEED_URL`, `GET /api/influencers`) that returns N people and their picks, then lists them next to the class. Empty prediction lists are allowed — a week without a stock video is not invented.

There is also a future push path at `POST /api/submissions`. The MVP prefers pull.

## How prediction cycles work

Cycles are ISO weeks (`2026-W01`, `2026-W02`, …). Every **Sunday at 23:59 Europe/Madrid** (21:59 UTC in CEST; Vercel Cron `59 21 * * 0`) the platform:

1. Resolves every pick whose Sunday `resolutionDate` has arrived (1W, 1M, 3M, 6M), using the latest market close available on or before that Sunday.
2. Fetches every enabled student endpoint (3 retries with backoff on timeouts / HTTP errors)
3. Validates the payload with Zod
4. Stores the raw JSON as a snapshot
5. Normalises the 12 picks
6. Locks **successful** snapshots. Students whose URL was down stay unlocked so `POST /api/admin/retry-failed` can fill them in without touching the others.

Previous weeks are never deleted. The job is weekly, not nightly — Hobby cron includes this (typically up to 2 jobs, minimum once per day; weekly is fine).

## How snapshots work

A snapshot is the official prediction for that student and week.

- Written in the same transaction as the normalised rows
- Hash of the raw body is stored
- After `locked_at != null`, further fetches bounce with `ImmutableSnapshotError`
- Corrections go through `audit_logs`, never a silent overwrite

## How the leaderboard works

Each resolved prediction is a hit when `realized_return >= 10%`.

The headline score is a weighted blend, declared once in `src/config/leaderboard.ts`:

| Component | Weight |
| --- | ---: |
| Hit rate | 30% |
| Calibration / Brier skill | 25% |
| Relative return (alpha vs cohort) | 25% |
| Consistency | 10% |
| Sample reliability | 10% |

Students with fewer than 12 resolved predictions appear as **provisional** and do not occupy the main ranking. Filters: this week / 4 weeks / 8 weeks / current RA / semester / all time, and OVERALL / 1W / 1M / 3M / 6M.

## How results are resolved

`calculateResolutionDate()` anchors every snapshot to its cycle-closing Sunday. Horizons then close 1, 4, 13 or 26 Sundays later. The weekly job uses the latest market close available on or before that Sunday (normally Friday), so the date shown in the UI is the same event that publishes the points.

When that date arrives, `MockMarketDataProvider` or `YahooFinanceProvider` supplies the two closes. The official outcome is close-to-close, not the intraday high.

## How mock data was generated

`src/lib/mock/dataset.ts` builds a reproducible season from `MOCK_SEED=value-investing-challenge-2026`:

- 16 students with distinct archetypes (overconfident, well-calibrated, one-hit wonder, late improver, …)
- 10 stocks: AAPL, MSFT, NVDA, META, GOOGL, AMZN, TSLA, JPM, V, NFLX
- 40 weekly cycles spanning RA1 → RA2 → RA3
- 12 predictions per student per cycle
- Features that stay internally consistent (high growth raises `growth_score`, high debt lowers `financial_health_score`)
- Mix of resolved and still-active predictions

Export the teaching files with `npm run data:export`. They land in `data/mock/` as CSV and JSON.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Mock mode is the default: no database, no student APIs, a full leaderboard on first load.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Database configuration

The schema is plain PostgreSQL. Neon and Supabase are both just a `DATABASE_URL`.

```bash
# .env.local
MOCK_MODE=false
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
ADMIN_TOKEN=   # openssl rand -hex 32
```

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

### Neon

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the pooled connection string
3. Put it in `DATABASE_URL`
4. Run migrate + seed

### Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Project Settings → Database → URI
3. Use the pooled URI (port 6543) for serverless
4. Same migrate + seed

No Neon- or Supabase-specific code exists in this repo.

## How to add a student

Edit `src/config/students.ts`:

```ts
{
  id: "student-01",
  name: "Laura García",
  handle: "lgarcia",
  api: {
    baseUrl: "https://lgarcia-investing.vercel.app",
    predictions: "/api/predictions",
    health: "/api/health",
  },
  enabled: true,
}
```

If the endpoint needs a bearer token, set `api.apiKeyEnvVar` to the **name** of an environment variable. The value never leaves the server.

## Mock mode

`MOCK_MODE` defaults to `true`. It also stays on if `DATABASE_URL` is missing, so a forgotten env file cannot render an empty championship.

When mock mode is on:

- 16 generated students
- generated prices, features and predictions
- admin write routes refuse to pretend they locked a cycle

## Vercel

1. Import the repo
2. Framework preset: Next.js
3. Environment variables:

| Name | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes in prod | `https://your-app.vercel.app` |
| `MOCK_MODE` | no | `true` for demos, `false` for a live course |
| `DATABASE_URL` | when not mocking | Neon or Supabase pooled URI |
| `ADMIN_TOKEN` | for admin writes | header `Authorization: Bearer …` |
| `MARKET_DATA_PROVIDER` | no | `mock` or `yahoo` |
| `STUDENT_FETCH_TIMEOUT_MS` | no | default `8000` |
| `NEXT_PUBLIC_NOINDEX` | no | `true` on preview |

4. Deploy. First load in mock mode is already a full championship.

## Project briefs (the three PDFs)

Editable sources live in `docs/projects/`:

- [RA1_Data_Lake_Project.md](docs/projects/RA1_Data_Lake_Project.md)
- [RA2_Data_Warehouse_ML_Project.md](docs/projects/RA2_Data_Warehouse_ML_Project.md)
- [RA3_AI_Agents_Project.md](docs/projects/RA3_AI_Agents_Project.md)

Generate the PDFs:

```bash
npm run docs:pdf
```

Output: `docs/projects/*.pdf`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Vitest (metrics, contract, dates, snapshots) |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:seed` | Load the mock season into Postgres |
| `npm run data:export` | Write `data/mock/*.csv` and `*.json` |
| `npm run docs:pdf` | Build the three project PDFs |

## Future improvements

- Persist student roster fully in Postgres instead of `config/students.ts`
- Trading-calendar library instead of a hand-maintained holiday list
- Live Yahoo / Alpha Vantage / Finnhub providers behind the same interface
- Scheduled Sunday 23:59 Europe/Madrid fetch via Vercel cron (`59 21 * * 0`)
- Push-submission auth that students can use from CI
- Parquet export of the teaching dataset for the Spark labs
