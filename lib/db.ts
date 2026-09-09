import { sql } from '@vercel/postgres';

export async function getExistingUids(): Promise<Set<string>> {
  const res = await sql`SELECT uid FROM submissions`;
  return new Set(res.rows.map((r) => r.uid));
}

export async function getSubmissionByUid(uid: string) {
  const res = await sql`SELECT * FROM submissions WHERE uid = ${uid}`;
  return res.rows[0] || null;
}

export async function getSubmissionsByGithubLink(githubLink: string) {
  const res = await sql`SELECT * FROM submissions WHERE github_link = ${githubLink}`;
  return res.rows;
}

export async function upsertSubmission(row: Record<string, any>) {
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    .filter((c) => c !== 'uid')
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ');

  const query = `
    INSERT INTO submissions (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (uid) DO UPDATE SET ${updateSet}
  `;
  await sql.query(query, values);
}

export async function logLLMCall(
  uid: string,
  callType: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
) {
  await sql`
    INSERT INTO llm_calls (uid, call_type, model_used, input_tokens, output_tokens, cost_usd)
    VALUES (${uid}, ${callType}, ${model}, ${inputTokens}, ${outputTokens}, ${costUsd})
  `;
}

export async function startEvaluationRun(
  runType: string,
  requestedCount?: number,
  requestedUid?: string
) {
  const res = await sql`
    INSERT INTO evaluation_runs (run_type, requested_count, requested_uid)
    VALUES (${runType}, ${requestedCount ?? null}, ${requestedUid ?? null})
    RETURNING id
  `;
  return res.rows[0].id as number;
}

export async function finishEvaluationRun(
  runId: number,
  rowsProcessed: number,
  rowsErrored: number,
  totalCostUsd: number
) {
  await sql`
    UPDATE evaluation_runs
    SET rows_processed = ${rowsProcessed},
        rows_errored = ${rowsErrored},
        total_cost_usd = ${totalCostUsd},
        finished_at = NOW()
    WHERE id = ${runId}
  `;
}

// --- Dashboard queries ---

export async function getSubmissionsForDashboard(dateFrom?: string, dateTo?: string) {
  if (dateFrom && dateTo) {
    const res = await sql`
      SELECT * FROM submissions
      WHERE evaluated_at >= ${dateFrom} AND evaluated_at <= ${dateTo}
      ORDER BY evaluated_at DESC
    `;
    return res.rows;
  }
  const res = await sql`SELECT * FROM submissions ORDER BY evaluated_at DESC`;
  return res.rows;
}

export async function getCostSummary(dateFrom?: string, dateTo?: string) {
  const dateFilter =
    dateFrom && dateTo ? sql`WHERE called_at >= ${dateFrom} AND called_at <= ${dateTo}` : sql``;

  const totalRes = dateFrom && dateTo
    ? await sql`
        SELECT COALESCE(SUM(cost_usd), 0) as total_cost,
               COUNT(DISTINCT uid) as projects_evaluated,
               COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens
        FROM llm_calls
        WHERE called_at >= ${dateFrom} AND called_at <= ${dateTo}
      `
    : await sql`
        SELECT COALESCE(SUM(cost_usd), 0) as total_cost,
               COUNT(DISTINCT uid) as projects_evaluated,
               COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens
        FROM llm_calls
      `;

  const byTypeRes = dateFrom && dateTo
    ? await sql`
        SELECT call_type,
               COUNT(*) as calls,
               COALESCE(SUM(input_tokens), 0) as input_tokens,
               COALESCE(SUM(output_tokens), 0) as output_tokens,
               COALESCE(SUM(cost_usd), 0) as cost
        FROM llm_calls
        WHERE called_at >= ${dateFrom} AND called_at <= ${dateTo}
        GROUP BY call_type
      `
    : await sql`
        SELECT call_type,
               COUNT(*) as calls,
               COALESCE(SUM(input_tokens), 0) as input_tokens,
               COALESCE(SUM(output_tokens), 0) as output_tokens,
               COALESCE(SUM(cost_usd), 0) as cost
        FROM llm_calls
        GROUP BY call_type
      `;

  const perProjectRes = dateFrom && dateTo
    ? await sql`
        SELECT uid,
               SUM(CASE WHEN call_type = 'text_authenticity' THEN cost_usd ELSE 0 END) as text_auth_cost,
               SUM(CASE WHEN call_type = 'repo_analysis' THEN cost_usd ELSE 0 END) as repo_analysis_cost,
               SUM(CASE WHEN call_type = 'project_scoring' THEN cost_usd ELSE 0 END) as scoring_cost,
               SUM(cost_usd) as total_cost,
               SUM(input_tokens + output_tokens) as total_tokens,
               MAX(called_at) as evaluated_at
        FROM llm_calls
        WHERE called_at >= ${dateFrom} AND called_at <= ${dateTo}
        GROUP BY uid
        ORDER BY total_cost DESC
      `
    : await sql`
        SELECT uid,
               SUM(CASE WHEN call_type = 'text_authenticity' THEN cost_usd ELSE 0 END) as text_auth_cost,
               SUM(CASE WHEN call_type = 'repo_analysis' THEN cost_usd ELSE 0 END) as repo_analysis_cost,
               SUM(CASE WHEN call_type = 'project_scoring' THEN cost_usd ELSE 0 END) as scoring_cost,
               SUM(cost_usd) as total_cost,
               SUM(input_tokens + output_tokens) as total_tokens,
               MAX(called_at) as evaluated_at
        FROM llm_calls
        GROUP BY uid
        ORDER BY total_cost DESC
      `;

  const allTimeRes = await sql`SELECT COALESCE(SUM(cost_usd), 0) as all_time_total FROM llm_calls`;

  const spendOverTimeRes =
    dateFrom && dateTo
      ? await sql`
          SELECT to_char(date_trunc('day', called_at), 'YYYY-MM-DD') as day,
                 COALESCE(SUM(cost_usd), 0) as cost
          FROM llm_calls
          WHERE called_at >= ${dateFrom} AND called_at <= ${dateTo}
          GROUP BY 1 ORDER BY 1
        `
      : await sql`
          SELECT to_char(date_trunc('day', called_at), 'YYYY-MM-DD') as day,
                 COALESCE(SUM(cost_usd), 0) as cost
          FROM llm_calls
          GROUP BY 1 ORDER BY 1
        `;

  return {
    summary: totalRes.rows[0],
    byCallType: byTypeRes.rows,
    perProject: perProjectRes.rows,
    allTimeTotal: allTimeRes.rows[0].all_time_total,
    spendOverTime: spendOverTimeRes.rows,
  };
}

// --- Paginated / filtered submissions (main table) ---

const SORTABLE_COLUMNS: Record<string, string> = {
  uid: 'uid',
  project_name: 'project_name',
  project_score: 'project_score',
  ai_use_score: 'ai_use_score',
  ai_use_level: 'ai_use_level',
  link_status: 'link_status',
  evaluated_at: 'evaluated_at',
  timestamp: 'timestamp',
};

export interface SubmissionQuery {
  page?: number;
  pageSize?: number;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  level?: string;
  linkStatus?: string;
  dupStatus?: string; // 'unique' | 'duplicate' | 'resubmission'
  search?: string;
  from?: string;
  to?: string;
}

export async function getSubmissionsPaged(q: SubmissionQuery) {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const sortCol = SORTABLE_COLUMNS[q.sortKey ?? 'evaluated_at'] ?? 'evaluated_at';
  const sortDir = q.sortDir === 'asc' ? 'ASC' : 'DESC';

  const where: string[] = [];
  const params: any[] = [];
  const bind = (value: any) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (q.level && q.level !== 'All') where.push(`ai_use_level = ${bind(q.level)}`);
  if (q.linkStatus && q.linkStatus !== 'All') where.push(`link_status = ${bind(q.linkStatus)}`);
  if (q.dupStatus === 'unique') where.push(`duplicate_status = 'Unique'`);
  if (q.dupStatus === 'duplicate') where.push(`duplicate_status ILIKE 'Duplicate%'`);
  if (q.dupStatus === 'resubmission') where.push(`duplicate_status ILIKE 'Superseded%'`);
  if (q.search) {
    const like = bind(`%${q.search}%`);
    where.push(`(uid ILIKE ${like} OR project_name ILIKE ${like})`);
  }
  if (q.from) where.push(`evaluated_at >= ${bind(q.from)}`);
  if (q.to) where.push(`evaluated_at <= ${bind(q.to)}`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await sql.query(
    `SELECT COUNT(*)::int AS total FROM submissions ${whereSql}`,
    params
  );
  const total: number = countRes.rows[0]?.total ?? 0;

  const rowsRes = await sql.query(
    `SELECT * FROM submissions ${whereSql}
     ORDER BY ${sortCol} ${sortDir} NULLS LAST
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );

  return { rows: rowsRes.rows, total, page, pageSize };
}

// --- Evaluation run history ---

export async function getEvaluationRuns(limit = 25) {
  const res = await sql`
    SELECT id, run_type, requested_count, requested_uid,
           rows_processed, rows_errored, total_cost_usd,
           started_at, finished_at
    FROM evaluation_runs
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return res.rows;
}

// --- Manual review queue ---

export async function getManualReviewRows() {
  const res = await sql`
    SELECT uid, project_name, github_link, link_status, duplicate_status,
           ai_use_level, ai_use_score, processing_status, error_detail, evaluated_at
    FROM submissions
    WHERE manual_review_needed = true
    ORDER BY evaluated_at DESC NULLS LAST
  `;
  return res.rows;
}

// --- Duplicate repo groups (repos shared by >1 submission) ---

export async function getDuplicateGroups() {
  const res = await sql`
    SELECT s.github_link AS link,
           json_agg(
             json_build_object(
               'uid', s.uid,
               'project_name', s.project_name,
               'timestamp', s.timestamp,
               'duplicate_status', s.duplicate_status,
               'processing_status', s.processing_status
             ) ORDER BY s.timestamp DESC
           ) AS rows,
           COUNT(DISTINCT s.uid) AS distinct_uids
    FROM submissions s
    WHERE s.github_link IS NOT NULL AND s.github_link <> ''
    GROUP BY s.github_link
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;
  return res.rows;
}

// --- Overview: project-score histogram buckets (0-9, 10-19, ... 90-100) ---

export async function getScoreHistogram() {
  const res = await sql`
    SELECT LEAST(FLOOR(project_score / 10), 9)::int AS bucket, COUNT(*)::int AS count
    FROM submissions
    WHERE project_score IS NOT NULL
    GROUP BY 1 ORDER BY 1
  `;
  const counts = new Array(10).fill(0);
  for (const r of res.rows) counts[r.bucket] = r.count;
  return counts.map((count, i) => ({
    label: i === 9 ? '90-100' : `${i * 10}-${i * 10 + 9}`,
    count,
  }));
}
