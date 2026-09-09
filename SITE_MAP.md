# Project Evaluator — Site Map

## Navigation Structure

```
Project Evaluator
│
├── 📊 Overview (/)
├── 📋 Submissions (/submissions)
│     └── Submission Detail (/submissions/[uid])
├── ⚠️ Manual Review Queue (/manual-review)
├── 🔁 Duplicates (/duplicates)
├── 💰 API Cost Management (/costs)
└── ▶️ Evaluate (/evaluate)   ← the trigger panel
```

---

## 1. Overview (`/`)
**What it's for:** first thing you see, quick pulse-check of the whole batch.

**Contains:**
- Summary cards: Total Submissions, Evaluated, Pending, Errors
- AI-Use breakdown: how many High / Medium / Low / N/A (donut or bar chart)
- Project Score distribution (histogram — most projects scoring where?)
- Link Status breakdown: Accessible / Not Reached / No Link / Deployed-Only
- Quick links into Manual Review Queue and Duplicates if either has pending items ("⚠️ 3 items need manual review")

---

## 2. Submissions (`/submissions`)
**What it's for:** the main working table — every evaluated row, filterable/sortable. This replaces scrolling a raw sheet.

**Contains:**
- Filters: Project Type, AI-Use Level, Link Status, Duplicate Status, Date range, search by UID/name
- Sortable columns: UID, Project Name, Project Score, AI Use Score, AI Use Level, Link Status, Evaluated At
- Click any row → goes to Submission Detail page
- Export button (CSV, in case you want to share a filtered slice outside the dashboard)

### 2a. Submission Detail (`/submissions/[uid]`)
**What it's for:** the "why" behind one student's flag — everything we found on them, one page.

**Contains:**
- Basic info: UID, project name, GitHub link (clickable), timestamp
- Project Score (0-100) + full feedback text + voice-gate pass/fail badge
- AI Use Score (0-100) + Level + full reasoning
- Text Authenticity Note (from form-answer analysis)
- Repo Analysis Note (from commit/artifact analysis)
- Duplicate/Resubmission status, with link to the other UID if relevant
- Cost breakdown for this specific evaluation (3 LLM calls, tokens, $ each)
- Manual "Re-evaluate this submission" button (force re-run)

---

## 3. Manual Review Queue (`/manual-review`)
**What it's for:** everything the pipeline couldn't confidently decide on its own — the "you look at this" list, in one place instead of buried in the main table.

**Contains:**
- Rows where `manual_review_needed = true`: deployed-link-only submissions, ambiguous AI-use calls, processing errors
- Same detail view as Submission Detail when clicked
- Optional: a simple "Mark Reviewed" toggle (just for your own tracking, doesn't change the score)

---

## 4. Duplicates (`/duplicates`)
**What it's for:** dedicated view for repo-collision cases, since these need a human decision (who copied whom).

**Contains:**
- Grouped by GitHub repo link — each group shows all UIDs sharing that repo
- Distinguishes clearly: "Resubmission (same student, latest kept)" vs "Duplicate (different students — needs review)"
- Timestamps side by side so you can see submission order at a glance

---

## 5. API Cost Management (`/costs`)
**What it's for:** the spend tracker — locked in earlier.

**Contains:**
- Date picker (Today / This Week / This Month / Custom Range)
- Summary cards: Total $ Spent, Projects Evaluated, Avg Cost/Project, Total Tokens
- Breakdown by Call Type (text-authenticity / repo-analysis / scoring) — table + chart
- Per-Project cost table, sortable, expandable rows for exact token counts
- All-time running total (footer, independent of date filter)
- Outlier warning banner for unusually expensive single evaluations

---

## 6. Evaluate (`/evaluate`)
**What it's for:** the control panel — where evaluation actually gets triggered. Deliberately separate from Overview so it's not accidentally clicked.

**Contains:**
- **Evaluate All New** button — runs every unprocessed row
- **Evaluate Specific Count** — number input + run button (e.g. "next 10")
- **Evaluate Specific UID** — text input + run button (includes force re-evaluate option with confirm warning)
- Live progress indicator while running: "Processing 12 of 47..."
- Run history log below: past runs with timestamp, type, rows processed, rows errored, cost of that run

---

## Data Flow Recap (how it all connects)

```
Response Sheet (Google Form)
        │
        ▼
  [Evaluate button pressed on /evaluate]
        │
        ▼
   Pipeline runs per new row
        │
        ▼
   Postgres DB (source of truth)
        │
        ├──► Output Sheet (synced copy)
        │
        └──► Dashboard pages (Overview, Submissions, Manual Review,
                               Duplicates, Costs) — all read live from DB
```

---

## Still open — confirm before I resume building
1. Does this page list cover everything you want, or should something be
   merged/split/removed? (e.g. maybe Duplicates folds into Manual Review
   instead of being separate — your call)
2. Any authentication needed on the dashboard (just you + Rushikesh, or is
   it fine unprotected behind the Vercel URL for now)?
