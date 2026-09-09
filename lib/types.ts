// Domain types — mirror db/schema.sql. Postgres returns numerics as strings,
// so cost/score fields that come straight off a row are typed loosely where
// that actually happens and coerced with Number() at the edge.

export type AiUseLevel = 'High' | 'Medium' | 'Low' | 'N/A';

export type ProcessingStatus = 'Pending' | 'Done' | 'Error' | 'Skipped';

export interface Submission {
  uid: string;
  timestamp: string | null;
  project_name: string | null;
  github_link: string | null;
  raw_github_link: string | null;
  ai_usage_answer: string | null;
  ai_usage_description: string | null;
  known_issues: string | null;

  link_status: string | null;
  duplicate_status: string | null;
  superseded_by: string | null;
  duplicate_of: string | null;

  project_score: number | null;
  project_feedback: string | null;
  voice_gate_passed: boolean | null;

  ai_use_score: number | null;
  ai_use_level: AiUseLevel | null;
  ai_use_reason: string | null;
  text_authenticity_note: string | null;
  repo_analysis_note: string | null;

  manual_review_needed: boolean;
  processing_status: ProcessingStatus;
  error_detail: string | null;

  evaluated_at: string | null;
  created_at: string | null;
}

export interface LlmCall {
  call_type: 'text_authenticity' | 'repo_analysis' | 'project_scoring' | string;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string | number;
  called_at: string;
}

export interface EvaluationRun {
  id: number;
  run_type: 'all_new' | 'specific_count' | 'specific_uid' | string;
  requested_count: number | null;
  requested_uid: string | null;
  rows_processed: number;
  rows_errored: number;
  total_cost_usd: string | number;
  started_at: string;
  finished_at: string | null;
}

export interface SubmissionsPage {
  submissions: Submission[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SubmissionDetail {
  submission: Submission;
  llmCalls: LlmCall[];
}

// --- Cost summary shapes (from lib/db.getCostSummary) ---

export interface CostSummary {
  summary: {
    total_cost: string | number;
    projects_evaluated: string | number;
    total_tokens: string | number;
  };
  byCallType: Array<{
    call_type: string;
    calls: string | number;
    input_tokens: string | number;
    output_tokens: string | number;
    cost: string | number;
  }>;
  perProject: Array<{
    uid: string;
    text_auth_cost: string | number;
    repo_analysis_cost: string | number;
    scoring_cost: string | number;
    total_cost: string | number;
    total_tokens: string | number;
    evaluated_at: string | null;
  }>;
  allTimeTotal: string | number;
  spendOverTime?: Array<{ day: string; cost: string | number }>;
}
