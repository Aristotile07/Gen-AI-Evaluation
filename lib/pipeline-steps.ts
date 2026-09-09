// The fixed pipeline shape. `evaluateSubmission` emits StepEvents keyed by
// these ids; the Flow diagram renders one node per entry, in this order.

export type StepId =
  | 'sheet'
  | 'validate'
  | 'url_check'
  | 'dup_check'
  | 'repo_fetch'
  | 'artifacts'
  | 'llm_text_auth'
  | 'llm_repo_analysis'
  | 'llm_scoring'
  | 'aggregate'
  | 'db_save'
  | 'sheet_sync';

export type StepStatus = 'start' | 'ok' | 'skip' | 'error';

export interface StepEvent {
  type: 'step';
  uid: string;
  step: StepId;
  status: StepStatus;
  /** wall-clock duration of the step in ms (present on ok/skip/error) */
  ms?: number;
  /** short human detail: "47 commits", "429 insufficient_quota", "$0.0003 · 1.2k tok" */
  detail?: string;
  /** ISO timestamp the event was emitted */
  at: string;
}

export interface StepNode {
  id: StepId;
  label: string;
  /** logical lane: linear spine, or the AI-analysis cluster */
  group: 'spine' | 'ai';
  hint: string;
}

export const PIPELINE_NODES: StepNode[] = [
  { id: 'sheet', label: 'Read sheet row', group: 'spine', hint: 'Row from the Google Form response sheet' },
  { id: 'validate', label: 'Validate link', group: 'spine', hint: 'Is a repository link present?' },
  { id: 'url_check', label: 'GitHub URL check', group: 'spine', hint: 'Parseable GitHub repo URL?' },
  { id: 'dup_check', label: 'Duplicate check', group: 'spine', hint: 'Same repo already submitted by someone else?' },
  { id: 'repo_fetch', label: 'Fetch repo', group: 'spine', hint: 'Commits, README, file tree via GitHub API' },
  { id: 'artifacts', label: 'Fetch artifacts', group: 'spine', hint: 'Notebook / transcript / prompt files from the tree' },
  { id: 'llm_text_auth', label: 'LLM · Text authenticity', group: 'ai', hint: 'Analyse the form free-text answers' },
  { id: 'llm_repo_analysis', label: 'LLM · Repo analysis', group: 'ai', hint: 'AI-reliance signals from commits & artifacts' },
  { id: 'llm_scoring', label: 'LLM · Project scoring', group: 'ai', hint: 'Quality score against the locked rubric' },
  { id: 'aggregate', label: 'Aggregate', group: 'spine', hint: 'Combine scores, set AI-use level & review flags' },
  { id: 'db_save', label: 'Save to Postgres', group: 'spine', hint: 'Upsert the submissions row' },
  { id: 'sheet_sync', label: 'Sync to output sheet', group: 'spine', hint: 'Write the clean row to the output Google Sheet' },
];

export const STEP_LABEL: Record<StepId, string> = Object.fromEntries(
  PIPELINE_NODES.map((n) => [n.id, n.label])
) as Record<StepId, string>;

/** Roll a run's flat event list into a per-step status map for the current uid. */
export function reduceStepStates(
  events: StepEvent[],
  uid?: string
): Record<StepId, { status: StepStatus | 'idle'; detail?: string; ms?: number }> {
  const out = {} as Record<StepId, { status: StepStatus | 'idle'; detail?: string; ms?: number }>;
  for (const n of PIPELINE_NODES) out[n.id] = { status: 'idle' };
  const scoped = uid ? events.filter((e) => e.uid === uid) : events;
  for (const e of scoped) {
    const cur = out[e.step];
    if (!cur) continue;
    // start never overrides a finished state from a later retry within the same uid
    if (e.status === 'start' && cur.status !== 'idle') continue;
    out[e.step] = { status: e.status, detail: e.detail, ms: e.ms };
  }
  return out;
}
