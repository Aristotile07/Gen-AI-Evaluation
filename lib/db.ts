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

  return {
    summary: totalRes.rows[0],
    byCallType: byTypeRes.rows,
    perProject: perProjectRes.rows,
    allTimeTotal: allTimeRes.rows[0].all_time_total,
  };
}
