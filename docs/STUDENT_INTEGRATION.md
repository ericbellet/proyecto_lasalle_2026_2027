# Student integration guide

You do not build the website. You build a system that can answer one HTTP request.

Time needed: about ten minutes once your model can produce a shortlist.

## 1. Deploy an API

Anywhere with a public HTTPS URL works. Vercel, Render, Railway, or your laptop during development.

The professor platform only stores your URL. It never clones your repo.

## 2. Implement `GET /api/predictions`

Return JSON that matches the schema below. Nothing else is required for the weekly cycle.

`GET /api/health` is optional and useful for debugging.

## 3. Return this schema

```json
{
  "student_id": "student-01",
  "model_version": "v2",
  "model_name": "XGBoost multi-horizon",
  "generated_at": "2026-09-14T12:00:00Z",
  "predictions": [
    {
      "ticker": "META",
      "horizon": "1W",
      "rank": 1,
      "probability": 0.71,
      "expected_return": 0.14,
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
| `student_id` | The id the professor assigned you. Must match exactly. |
| `model_version` | `v1` in RA1, `v2` in RA2, `v3` in RA3. |
| `generated_at` | ISO-8601 **with timezone offset**. `Z` is fine. |
| `predictions` | 1–12 items. Top 3 per horizon × `{1W,1M,3M,6M}`. |
| `ticker` | Uppercase symbol. |
| `horizon` | `1W` \| `1M` \| `3M` \| `6M` |
| `rank` | `1`, `2` or `3`. Unique inside a horizon. |
| `probability` | Number in `[0, 1]`. Not a 0–100 percentage. |
| `expected_return` | Decimal. `0.14` means +14%. |

A payload that fails validation is **rejected entirely**. That week you do not score.

Common rejections: `generated_at` without offset, duplicate rank, ticker twice in the same horizon, probability `71` instead of `0.71`, more than 12 picks.

## 4. Send the professor your URL

```
https://your-project.vercel.app
```

The platform will call `https://your-project.vercel.app/api/predictions`.

## 5. The professor adds it to config

```ts
// src/config/students.ts
{
  id: "student-01",
  name: "Laura García",
  handle: "lgarcia",
  api: {
    baseUrl: "https://your-project.vercel.app",
    predictions: "/api/predictions",
    health: "/api/health",
  },
  enabled: true,
}
```

If you need a bearer token, tell the professor the **name** of an env var. Never put the token in this file.

---

## What a prediction means

Not: “this stock will go up.”

Yes:

> Given the information available today, my system estimates a 67% probability that this stock achieves at least +10% within the next 3 months.

The platform records that sentence as a snapshot **before** the outcome is known. Changing your endpoint afterwards does not change your official picks.

Use `v1` / `v2` / `v3` so we can ask later: did ML beat the manual score? Did agents beat ML?

---

## Python (stdlib)

```python
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

STUDENT_ID = "student-01"

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/api/predictions":
            self.send_error(404)
            return
        body = {
            "student_id": STUDENT_ID,
            "model_version": "v1",
            "model_name": "Weighted Value Score",
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
        "student_id": "student-01",
        "model_version": "v2",
        "model_name": "XGBoost multi-horizon",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "predictions": [
            {
                "ticker": p.ticker,
                "horizon": p.horizon,
                "rank": p.rank,
                "probability": round(p.probability, 4),
                "expected_return": round(p.expected_return, 4),
            }
            for p in picks
        ],
    }

@app.get("/api/health")
def health():
    return {"status": "ok", "model_version": "v2"}
```

## Next.js

```ts
// app/api/predictions/route.ts
import { NextResponse } from "next/server";

export const revalidate = 0;

export async function GET() {
  const picks = await topPicks();
  return NextResponse.json({
    student_id: "student-01",
    model_version: "v3",
    model_name: "Agent Committee",
    generated_at: new Date().toISOString(),
    predictions: picks,
  });
}
```

Deploy on Vercel. Send the professor the production URL.

---

## What happens on Monday

```
Your API  →  fetch  →  Zod validate  →  immutable snapshot  →  LOCK
```

After lock, the official prediction is the snapshot. Your live endpoint can keep changing; the grade does not.

When the horizon elapses, the platform reads two closing prices and scores:

```
hit_target = realized_return >= 0.10
brier      = (probability - hit)^2
```

Check your page at `/students/your-id` after the first locked cycle.

---

## Future: push instead of pull

`POST /api/submissions` exists on the professor platform for later. The MVP is pull-only. Do not depend on push this semester.

## Checklist

- [ ] Public HTTPS URL
- [ ] `GET /api/predictions` returns JSON
- [ ] `student_id` matches the roster
- [ ] `generated_at` includes `Z` or `+00:00`
- [ ] At most 12 predictions
- [ ] Ranks 1–3 unique per horizon
- [ ] Probabilities between 0 and 1
- [ ] Professor has the URL
