-- ============================================================
-- AI Reliance & Project Evaluation Dashboard — DB Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS submissions (
  uid                     TEXT PRIMARY KEY,
  timestamp               TIMESTAMPTZ,
  project_name            TEXT,
  github_link             TEXT,
  raw_github_link         TEXT,              -- as submitted, before normalization
  ai_usage_answer         TEXT,               -- Yes/No/Partial from the form
  ai_usage_description    TEXT,
  known_issues            TEXT,

  link_status             TEXT,               -- Accessible / Not Reached (404) / No Link Provided / Deployed Link Only
  duplicate_status         TEXT DEFAULT 'Unique', -- Unique / Superseded — Resubmission by same student / Duplicate — Same repo as UID <x>
  superseded_by            TEXT,               -- UID of the newer resubmission, if this row was superseded
  duplicate_of              TEXT,               -- UID of the other student's row sharing the same repo (real duplicate case)

  project_score            INTEGER,             -- 0-100
  project_feedback          TEXT,
  voice_gate_passed          BOOLEAN,            -- mandatory voice-in/voice-out check result

  ai_use_score              INTEGER,             -- 0-100
  ai_use_level               TEXT,               -- High / Medium / Low / N/A
  ai_use_reason               TEXT,
  text_authenticity_note      TEXT,
  repo_analysis_note           TEXT,

  manual_review_needed          BOOLEAN DEFAULT FALSE,
  processing_status              TEXT DEFAULT 'Pending', -- Pending / Done / Error / Skipped (Superseded/Duplicate)
  error_detail                    TEXT,

  evaluated_at                     TIMESTAMPTZ,
  created_at                        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_github_link ON submissions (github_link);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (processing_status);
CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions (timestamp);

-- ============================================================
CREATE TABLE IF NOT EXISTS llm_calls (
  id               SERIAL PRIMARY KEY,
  uid              TEXT REFERENCES submissions(uid) ON DELETE CASCADE,
  call_type        TEXT NOT NULL,   -- text_authenticity / repo_analysis / project_scoring
  model_used       TEXT NOT NULL,
  input_tokens     INTEGER NOT NULL DEFAULT 0,
  output_tokens    INTEGER NOT NULL DEFAULT 0,
  cost_usd         NUMERIC(10, 6) NOT NULL DEFAULT 0,
  called_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_uid ON llm_calls (uid);
CREATE INDEX IF NOT EXISTS idx_llm_calls_called_at ON llm_calls (called_at);
CREATE INDEX IF NOT EXISTS idx_llm_calls_call_type ON llm_calls (call_type);

-- ============================================================
-- Run log — tracks each "Evaluate" trigger for auditing
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id               SERIAL PRIMARY KEY,
  run_type         TEXT NOT NULL,   -- all_new / specific_count / specific_uid
  requested_count  INTEGER,
  requested_uid    TEXT,
  rows_processed   INTEGER DEFAULT 0,
  rows_errored     INTEGER DEFAULT 0,
  total_cost_usd   NUMERIC(10, 6) DEFAULT 0,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  finished_at      TIMESTAMPTZ
);

-- Per-step event log for a run (pipeline node timeline: start/ok/skip/error).
-- Added after the initial schema; safe to re-run.
ALTER TABLE evaluation_runs ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_evaluation_runs_started_at ON evaluation_runs (started_at);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_run_type ON evaluation_runs (run_type);
