# Project Evaluator

## What this is
Reads student project submissions from a Google Sheet, evaluates each one
(link check, duplicate/resubmission detection, AI-reliance analysis, project
quality scoring against a locked rubric), and shows results in a dashboard.
Also syncs results to a clean output Google Sheet and tracks OpenAI API cost
per evaluation.

## Local setup

```bash
npm install
```

Copy `.env.template` to `.env.local` and fill in the same values you already
added to Vercel (GITHUB_TOKEN, OPENAI_API_KEY, GOOGLE_SERVICE_ACCOUNT_JSON,
RESPONSE_SHEET_ID, OUTPUT_SHEET_ID, DASHBOARD_USERNAME, DASHBOARD_PASSWORD).
`.env.local` is git-ignored — never commit it.

Pull the Postgres connection string from Vercel:
```bash
npx vercel link
npx vercel env pull .env.local
```

## Push the database schema

Once `.env.local` has `POSTGRES_URL` (auto-pulled from Vercel above):
```bash
npm run db:push
```
This creates the `submissions`, `llm_calls`, and `evaluation_runs` tables.
Safe to re-run — uses `CREATE TABLE IF NOT EXISTS`.

## Run locally

```bash
npm run dev
```
Open http://localhost:3000 — you'll be prompted for the dashboard
username/password (from your env vars).

## Deploy to Vercel

Push this folder to a GitHub repo, then import it in Vercel (or if you
already created a blank Vercel project, connect this repo to it via
Settings → Git). Vercel auto-detects Next.js and deploys.

Make sure all env vars are set in Vercel (Settings → Environments →
Production) before the first deploy — the app will fail to build/run
without them.

After deploying, run the schema push once against the production DB too
(same `npm run db:push` command, but with production env vars — or just
run it locally once since it's the same DB either way, as long as
`POSTGRES_URL` in `.env.local` points to the same Vercel Postgres instance).

## Folder structure

```
app/
  page.tsx                    Overview page
  submissions/page.tsx        Submissions list
  submissions/[uid]/page.tsx  Submission detail
  manual-review/page.tsx      Manual review queue
  duplicates/page.tsx         Duplicate repo groups
  costs/page.tsx              API cost management
  evaluate/page.tsx           Evaluation trigger panel
  api/
    evaluate/all/route.ts     POST — evaluate all new rows (streams NDJSON progress)
    evaluate/count/route.ts   POST — evaluate next N new rows (streams NDJSON progress)
    evaluate/uid/route.ts     POST — evaluate/re-evaluate one UID
    submissions/route.ts      GET — paginated/filtered/sorted submissions
    submissions/[uid]/route.ts GET — one submission + its LLM call log
    manual-review/route.ts    GET — rows flagged for manual review
    duplicates/route.ts       GET — repo groups shared by >1 submission
    runs/route.ts             GET — evaluation run history
    costs/route.ts            GET — cost summary + spend-over-time
lib/
  db.ts        Postgres query helpers
  sheets.ts    Google Sheets read/write (service account auth)
  github.ts    GitHub repo fetching (commits, README, file tree, artifacts)
  llm.ts       OpenAI call wrapper with token/cost tracking
  prompts.ts   The 3 LLM prompts + the locked project-type rubric
  pipeline.ts  Orchestrates all steps for one submission
db/
  schema.sql   Table definitions
  migrate.js   Pushes schema.sql to Postgres
middleware.ts  Basic-auth gate for the whole dashboard
```

## Notes on the rubric
Project scoring rubric (per project type) lives in `lib/prompts.ts` under
`RUBRICS`. Voice-in + voice-out is a MANDATORY gate for every project type —
if either is missing, `voice_gate_passed = false` and the type-specific
score is capped at 10/50 regardless of other checks. Edit that object
directly if the rubric needs to change later; no other file needs touching.

## Cost model
Pricing is hardcoded in `lib/llm.ts` under `PRICING` (per-1M-token rates for
`gpt-4.1-mini`). If OpenAI changes pricing or you switch models, update that
object — it directly drives every cost number in the dashboard.
