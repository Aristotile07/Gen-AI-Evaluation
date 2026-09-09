import { sql } from '@vercel/postgres';
import {
  parseGithubUrl,
  isGithubUrl,
  fetchRepoData,
  fetchArtifactFiles,
} from './github';
import { callLLM } from './llm';
import {
  textAuthenticityPrompt,
  repoAnalysisPrompt,
  projectScoringPrompt,
  parseScoreNote,
  parseProjectScore,
} from './prompts';
import { logLLMCall, getSubmissionsByGithubLink, upsertSubmission } from './db';
import type { ResponseRow } from './sheets';
import { upsertOutputRow } from './sheets';
import type { StepEvent, StepId } from './pipeline-steps';
import { PIPELINE_NODES } from './pipeline-steps';

export interface PipelineResult {
  uid: string;
  status: 'done' | 'error' | 'skipped';
  errorDetail?: string;
  costUsd: number;
}

export type OnStep = (e: StepEvent) => void;

function aiUseLevel(score: number): string {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

// Normalizes a github link for duplicate comparison (case, trailing slash, .git, www)
function normalizeGithubLink(url: string): string {
  if (!url) return '';
  let u = url.trim().toLowerCase();
  if (!u.startsWith('http')) u = 'https://' + u;
  u = u.replace(/\.git$/, '').replace(/\/$/, '');
  return u;
}

function errDetail(err: any): string {
  if (err?.status) {
    return `${err.status} ${err.code || err.type || err.message || ''}`.trim();
  }
  return err?.message || String(err);
}

// Builds the per-step emitter. `step()` times a unit of work and emits
// start -> ok / error around it; `mark()` emits a one-shot ok/skip/error.
function makeStepper(uid: string, onStep?: OnStep) {
  const emit = (step: StepId, status: StepEvent['status'], extra?: { ms?: number; detail?: string }) =>
    onStep?.({ type: 'step', uid, step, status, at: new Date().toISOString(), ...extra });

  async function step<T>(
    id: StepId,
    fn: () => Promise<T> | T,
    describe?: (r: T) => string | undefined
  ): Promise<T> {
    const t0 = Date.now();
    emit(id, 'start');
    try {
      const r = await fn();
      emit(id, 'ok', { ms: Date.now() - t0, detail: describe?.(r) });
      return r;
    } catch (err) {
      emit(id, 'error', { ms: Date.now() - t0, detail: errDetail(err) });
      throw err;
    }
  }

  const mark = (id: StepId, status: StepEvent['status'], detail?: string) => emit(id, status, { detail });

  // Mark every step from `fromId` onward as skipped (used on early-exit branches).
  function skipRest(fromId: StepId, detail?: string) {
    const idx = PIPELINE_NODES.findIndex((n) => n.id === fromId);
    for (const n of PIPELINE_NODES.slice(idx)) emit(n.id, 'skip', { detail });
  }

  return { step, mark, skipRest };
}

export async function evaluateSubmission(
  row: ResponseRow,
  forceReeval = false,
  onStep?: OnStep
): Promise<PipelineResult> {
  let totalCost = 0;
  const { step, mark, skipRest } = makeStepper(row.uid, onStep);

  mark('sheet', 'ok', row.projectName || row.uid);

  // --- Step 1: Validate row ---
  if (!row.githubLink || row.githubLink.trim() === '') {
    mark('validate', 'error', 'No repository link provided');
    skipRest('url_check', 'No link — nothing to fetch');
    await step('db_save', () =>
      upsertSubmission({
        uid: row.uid,
        timestamp: row.timestamp || null,
        project_name: row.projectName,
        github_link: '',
        raw_github_link: row.githubLink,
        ai_usage_answer: row.aiUsageAnswer,
        ai_usage_description: row.aiUsageDescription,
        known_issues: row.knownIssues,
        link_status: 'No Link Provided',
        processing_status: 'Done',
        manual_review_needed: true,
        evaluated_at: new Date().toISOString(),
      })
    );
    await step('sheet_sync', () =>
      upsertOutputRow({
        uid: row.uid,
        projectName: row.projectName,
        githubLink: '',
        linkStatus: 'No Link Provided',
        duplicateFlag: 'N/A',
        projectScore: null,
        projectFeedback: 'No repository link provided — cannot evaluate.',
        voiceGatePassed: null,
        aiUseScore: null,
        aiUseLevel: 'N/A',
        aiUseReason: 'N/A — no link to review.',
        textAuthenticityNote: '',
        repoAnalysisNote: '',
        manualReviewNeeded: true,
        processingStatus: 'Done',
      })
    );
    return { uid: row.uid, status: 'done', costUsd: 0 };
  }
  mark('validate', 'ok');

  // --- Step 2: Link check ---
  if (!isGithubUrl(row.githubLink)) {
    mark('url_check', 'skip', 'Deployed link, not a GitHub repo');
    skipRest('dup_check', 'Manual review — not a repo');
    await step('db_save', () =>
      upsertSubmission({
        uid: row.uid,
        timestamp: row.timestamp || null,
        project_name: row.projectName,
        github_link: row.githubLink,
        raw_github_link: row.githubLink,
        ai_usage_answer: row.aiUsageAnswer,
        ai_usage_description: row.aiUsageDescription,
        known_issues: row.knownIssues,
        link_status: 'Deployed Link Only (Manual Review)',
        processing_status: 'Done',
        manual_review_needed: true,
        evaluated_at: new Date().toISOString(),
      })
    );
    await step('sheet_sync', () =>
      upsertOutputRow({
        uid: row.uid,
        projectName: row.projectName,
        githubLink: row.githubLink,
        linkStatus: 'Deployed Link Only (Manual Review)',
        duplicateFlag: 'N/A',
        projectScore: null,
        projectFeedback: 'Link is not a GitHub repo (likely a deployed app link) — needs manual review.',
        voiceGatePassed: null,
        aiUseScore: null,
        aiUseLevel: 'N/A',
        aiUseReason: 'N/A — deployed link, not a repo, needs manual check.',
        textAuthenticityNote: '',
        repoAnalysisNote: '',
        manualReviewNeeded: true,
        processingStatus: 'Done',
      })
    );
    return { uid: row.uid, status: 'done', costUsd: 0 };
  }

  const parsed = parseGithubUrl(row.githubLink);
  if (!parsed) {
    mark('url_check', 'error', 'Could not parse GitHub URL');
    skipRest('dup_check', 'Unparseable URL');
    await step('db_save', () =>
      upsertSubmission({
        uid: row.uid,
        timestamp: row.timestamp || null,
        project_name: row.projectName,
        github_link: row.githubLink,
        raw_github_link: row.githubLink,
        link_status: 'Not Reached (404)',
        processing_status: 'Error',
        error_detail: 'Could not parse GitHub URL',
        manual_review_needed: true,
        evaluated_at: new Date().toISOString(),
      })
    );
    return { uid: row.uid, status: 'error', errorDetail: 'Unparseable URL', costUsd: 0 };
  }
  mark('url_check', 'ok', `${parsed.owner}/${parsed.repo}`);

  const normalizedLink = normalizeGithubLink(row.githubLink);

  // --- Step 3: Duplicate / resubmission check ---
  const duplicateFlag = await step(
    'dup_check',
    async () => {
      const existingSameLink = await getSubmissionsByGithubLink(normalizedLink);
      const otherStudentRows = existingSameLink.filter((r) => r.uid !== row.uid);
      return otherStudentRows.length > 0
        ? `Duplicate — Same repo as UID ${otherStudentRows[0].uid}`
        : 'Unique';
    },
    (flag) => flag
  );

  // --- Step 4: Fetch repo ---
  const repoData = await step(
    'repo_fetch',
    () => fetchRepoData(parsed.owner, parsed.repo),
    (d) =>
      d.status === 'accessible'
        ? `${d.commits?.length ?? 0} commits`
        : d.status === 'not_found'
          ? 'repo 404'
          : `error: ${d.errorDetail ?? 'unknown'}`
  );

  if (repoData.status === 'not_found') {
    skipRest('artifacts', 'Repo unreachable (404)');
    await step('db_save', () =>
      upsertSubmission({
        uid: row.uid,
        timestamp: row.timestamp || null,
        project_name: row.projectName,
        github_link: normalizedLink,
        raw_github_link: row.githubLink,
        ai_usage_answer: row.aiUsageAnswer,
        ai_usage_description: row.aiUsageDescription,
        known_issues: row.knownIssues,
        link_status: 'Not Reached (404)',
        duplicate_status: duplicateFlag,
        processing_status: 'Done',
        manual_review_needed: true,
        evaluated_at: new Date().toISOString(),
      })
    );
    await step('sheet_sync', () =>
      upsertOutputRow({
        uid: row.uid,
        projectName: row.projectName,
        githubLink: row.githubLink,
        linkStatus: 'Not Reached (404)',
        duplicateFlag,
        projectScore: null,
        projectFeedback: 'Repository not found (404) — may be private, deleted, or renamed.',
        voiceGatePassed: null,
        aiUseScore: null,
        aiUseLevel: 'N/A',
        aiUseReason: 'N/A — repo unreachable.',
        textAuthenticityNote: '',
        repoAnalysisNote: '',
        manualReviewNeeded: true,
        processingStatus: 'Done',
      })
    );
    return { uid: row.uid, status: 'done', costUsd: 0 };
  }

  if (repoData.status === 'error') {
    skipRest('artifacts', repoData.errorDetail || 'Repo fetch error');
    await step('db_save', () =>
      upsertSubmission({
        uid: row.uid,
        timestamp: row.timestamp || null,
        project_name: row.projectName,
        github_link: normalizedLink,
        raw_github_link: row.githubLink,
        link_status: 'Error',
        duplicate_status: duplicateFlag,
        processing_status: 'Error',
        error_detail: repoData.errorDetail,
        manual_review_needed: true,
        evaluated_at: new Date().toISOString(),
      })
    );
    return { uid: row.uid, status: 'error', errorDetail: repoData.errorDetail, costUsd: 0 };
  }

  const artifactFiles = await step(
    'artifacts',
    () => fetchArtifactFiles(parsed.owner, parsed.repo, repoData.fileTree),
    (files) => `${files?.length ?? 0} files`
  );

  // --- Step 5a: Text Authenticity (LLM) ---
  const textPrompt = textAuthenticityPrompt(row.aiUsageAnswer, row.aiUsageDescription, row.knownIssues);
  const textResult = await step(
    'llm_text_auth',
    () => callLLM(textPrompt.system, textPrompt.user),
    (r) => `$${r.costUsd.toFixed(5)} · ${((r.inputTokens + r.outputTokens) / 1000).toFixed(1)}k tok`
  );
  const textParsed = parseScoreNote(textResult.content);
  await logLLMCall(row.uid, 'text_authenticity', textResult.model, textResult.inputTokens, textResult.outputTokens, textResult.costUsd);
  totalCost += textResult.costUsd;

  // --- Step 5b: Repo AI-Reliance Analysis (LLM) ---
  const repoPrompt = repoAnalysisPrompt(repoData.commits, repoData.fileTree, repoData.readmeContent, artifactFiles);
  const repoResult = await step(
    'llm_repo_analysis',
    () => callLLM(repoPrompt.system, repoPrompt.user),
    (r) => `$${r.costUsd.toFixed(5)} · ${((r.inputTokens + r.outputTokens) / 1000).toFixed(1)}k tok`
  );
  const repoParsed = parseScoreNote(repoResult.content);
  await logLLMCall(row.uid, 'repo_analysis', repoResult.model, repoResult.inputTokens, repoResult.outputTokens, repoResult.costUsd);
  totalCost += repoResult.costUsd;

  // --- Step 5c: Project Quality Scoring (LLM) ---
  const scoringPrompt = projectScoringPrompt(row.projectName, repoData.commits, repoData.fileTree, repoData.readmeContent);
  const scoringResult = await step(
    'llm_scoring',
    () => callLLM(scoringPrompt.system, scoringPrompt.user),
    (r) => `$${r.costUsd.toFixed(5)} · ${((r.inputTokens + r.outputTokens) / 1000).toFixed(1)}k tok`
  );
  const scoringParsed = parseProjectScore(scoringResult.content);
  await logLLMCall(row.uid, 'project_scoring', scoringResult.model, scoringResult.inputTokens, scoringResult.outputTokens, scoringResult.costUsd);
  totalCost += scoringResult.costUsd;

  // --- Step 6: Aggregate ---
  const { aiUseScore, level, combinedReason, manualReview } = await step(
    'aggregate',
    () => {
      const aiUseScore = Math.round((textParsed.score + repoParsed.score) / 2);
      const level = aiUseLevel(aiUseScore);
      const combinedReason = `Text authenticity: ${textParsed.note} | Repo analysis: ${repoParsed.note}`;
      const manualReview = duplicateFlag !== 'Unique' || level === 'High' || !scoringParsed.voiceGatePassed;
      return { aiUseScore, level, combinedReason, manualReview };
    },
    (r) => `AI use ${r.aiUseScore} (${r.level})${r.manualReview ? ' · needs review' : ''}`
  );

  await step('db_save', () =>
    upsertSubmission({
      uid: row.uid,
      timestamp: row.timestamp || null,
      project_name: row.projectName,
      github_link: normalizedLink,
      raw_github_link: row.githubLink,
      ai_usage_answer: row.aiUsageAnswer,
      ai_usage_description: row.aiUsageDescription,
      known_issues: row.knownIssues,
      link_status: 'Accessible',
      duplicate_status: duplicateFlag,
      project_score: scoringParsed.score,
      project_feedback: scoringParsed.feedback,
      voice_gate_passed: scoringParsed.voiceGatePassed,
      ai_use_score: aiUseScore,
      ai_use_level: level,
      ai_use_reason: combinedReason,
      text_authenticity_note: textParsed.note,
      repo_analysis_note: repoParsed.note,
      manual_review_needed: manualReview,
      processing_status: 'Done',
      evaluated_at: new Date().toISOString(),
    })
  );

  await step('sheet_sync', () =>
    upsertOutputRow({
      uid: row.uid,
      projectName: row.projectName,
      githubLink: row.githubLink,
      linkStatus: 'Accessible',
      duplicateFlag,
      projectScore: scoringParsed.score,
      projectFeedback: scoringParsed.feedback,
      voiceGatePassed: scoringParsed.voiceGatePassed,
      aiUseScore,
      aiUseLevel: level,
      aiUseReason: combinedReason,
      textAuthenticityNote: textParsed.note,
      repoAnalysisNote: repoParsed.note,
      manualReviewNeeded: manualReview,
      processingStatus: 'Done',
    })
  );

  return { uid: row.uid, status: 'done', costUsd: totalCost };
}
