# Student integration guide

You do not build the website. You build a system that can answer one HTTP request.

Time needed: about ten minutes once your model can produce a shortlist.

## 1. Start from the class template (Copier)

The dummy API (`eric-bellet-predictions`) is Eric Bellet's live example. Generate **your** project so the `student` field is your name:

```bash
uvx copier copy gh:ericbellet/eric-bellet-predictions ./my-predictions
cd my-predictions
```

Choose Next.js (Vercel) or FastAPI + UV. Copier fills 12 starting tickers; swap them for your model before Sunday lock.

Then deploy anywhere with a public HTTPS URL. The professor platform only stores that URL. It never clones your repo.

## 2. Implement `GET /api/predictions`

Return JSON that matches the schema below. Nothing else is required for the weekly cycle.

`GET /api/health` is optional and useful for debugging.

## 3. Return this schema

```json
{
  "student": "Laura García",
  "generated_at": "2026-09-14T12:00:00Z",
  "predictions": [
    {
      "ticker": "META",
      "horizon": "1W",
      "rank": 1,
      "target_price": 712.4,
      "investment_thesis": "optional",
      "risks": "optional"
    }
  ]
}
```

### Required fields

| Field | Rule |
| --- | --- |
| `student` | Your name, as the professor registered it. Accents and extra spaces do not matter. |
| `generated_at` | ISO-8601 **with timezone offset**. `Z` is fine. |
| `predictions` | 1–12 items. Top 3 per horizon × `{1W,1M,3M,6M}`. |
| `ticker` | Uppercase symbol. |
| `horizon` | `1W` \| `1M` \| `3M` \| `6M` |
| `rank` | `1`, `2` or `3`. Unique inside a horizon. |

Do not send `model_name`, `model_version`, `probability` or `expected_return`. Extra fields are ignored; they are not part of the contract.

A payload that fails validation is **rejected entirely**. That week you do not score.

Common rejections: `generated_at` without offset, duplicate rank, ticker twice in the same horizon, more than 12 picks.

## 4. Send the professor your URL

```
https://your-project.vercel.app
```

The platform will call `https://your-project.vercel.app/api/predictions`.

## 5. The professor registers your name and URL

On `/integrate` the professor stores your **name** and the predictions URL. You do not get a student id to put in the JSON — the `student` field is your name.

If you need a bearer token, tell the professor the **name** of an env var. Never put the token in the payload.

---

## What a prediction means

Not: “this stock will go up.”

Yes:

> These three tickers are my system's top picks for this horizon. One point if a pick is up at least +10% at the deadline.

The platform records that sentence as a snapshot **before** the outcome is known. Changing your endpoint afterwards does not change your official picks.

The course still has three research areas (data lake, ML, agents). That lineage is in your project, not in the weekly JSON.

---

## Python (stdlib)

```python
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

STUDENT = "Laura García"

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/api/predictions":
            self.send_error(404)
            return
        body = {
            "student": STUDENT,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "predictions": my_top_picks(),  # your RA1/RA2/RA3 system
        }
        payload = json.dumps(body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(payload)

if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
```

## FastAPI

```python
from datetime import datetime, timezone
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/predictions")
def predictions():
    picks = my_model.top_picks()
    return {
        "student": "Laura García",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "predictions": [
            {
                "ticker": p.ticker,
                "horizon": p.horizon,
                "rank": p.rank,
            }
            for p in picks
        ],
    }

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

## Next.js

```ts
// app/api/predictions/route.ts
import { NextResponse } from "next/server";

export const revalidate = 0;

export async function GET() {
  const picks = await topPicks();
  return NextResponse.json({
    student: "Laura García",
    generated_at: new Date().toISOString(),
    predictions: picks,
  });
}
```

Deploy on Vercel. Send the professor the production URL.

---

## What happens on Sunday

At 23:59 Europe/Madrid (21:59 UTC in summer) Vercel Cron pulls every registered URL:

```
Your API  →  fetch (3 tries)  →  Zod validate  →  immutable snapshot  →  LOCK that student
```

After lock, the official prediction is the snapshot. Your live endpoint can keep changing; the grade does not.

If your URL is down, the other students are still locked. The professor retries only the failed endpoints — they do not wait until next Sunday, because that would miss this week's 1W deadline.

When the horizon elapses, the platform reads two closing prices and scores:

```
hit_target = realized_return >= 0.10
points     = 1 if hit else 0
```

Check your page at `/students/your-id` after the first locked cycle.

---

## Future: push instead of pull

`POST /api/submissions` exists on the professor platform for later. The MVP is pull-only. Do not depend on push this semester.

## Checklist

- [ ] Public HTTPS URL
- [ ] `GET /api/predictions` returns JSON
- [ ] `student` is your name, as registered
- [ ] `generated_at` includes `Z` or `+00:00`
- [ ] At most 12 predictions
- [ ] Ranks 1–3 unique per horizon
- [ ] Professor has the URL
