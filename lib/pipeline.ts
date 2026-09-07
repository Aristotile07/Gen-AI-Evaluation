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

export interface PipelineResult {
  uid: string;
  status: 'done' | 'error' | 'skipped';
  errorDetail?: string;
  costUsd: number;
}

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

export async function evaluateSubmission(row: ResponseRow, forceReeval = false): Promise<PipelineResult> {
  let totalCost = 0;

  // --- Step 1: Validate row ---
  if (!row.githubLink || row.githubLink.trim() === '') {
    await upsertSubmission({
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
    });
    await upsertOutputRow({
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
    });
    return { uid: row.uid, status: 'done', costUsd: 0 };
  }

  // --- Step 2: Link check ---
  if (!isGithubUrl(row.githubLink)) {
    // Deployed link only (e.g. Vercel/Streamlit URL) — needs manual review, no automated eval
    await upsertSubmission({
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
    });
    await upsertOutputRow({
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
    });
    return { uid: row.uid, status: 'done', costUsd: 0 };
  }

  const parsed = parseGithubUrl(row.githubLink);
  if (!parsed) {
    await upsertSubmission({
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
    });
    return { uid: row.uid, status: 'error', errorDetail: 'Unparseable URL', costUsd: 0 };
  }

  const normalizedLink = normalizeGithubLink(row.githubLink);

  // --- Step 3: Duplicate / resubmission check ---
  const existingSameLink = await getSubmissionsByGithubLink(normalizedLink);
  const otherStudentRows = existingSameLink.filter((r) => r.uid !== row.uid);
  let duplicateFlag = 'Unique';
  if (otherStudentRows.length > 0) {
    // Real duplicate: different UID pointing to the same repo
    duplicateFlag = `Duplicate — Same repo as UID ${otherStudentRows[0].uid}`;
  }

  // --- Step 4: Fetch repo ---
  const repoData = await fetchRepoData(parsed.owner, parsed.repo);

  if (repoData.status === 'not_found') {
    await upsertSubmission({
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
    });
    await upsertOutputRow({
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
    });
    return { uid: row.uid, status: 'done', costUsd: 0 };
  }

  if (repoData.status === 'error') {
    await upsertSubmission({
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
    });
    return { uid: row.uid, status: 'error', errorDetail: repoData.errorDetail, costUsd: 0 };
  }

  const artifactFiles = await fetchArtifactFiles(parsed.owner, parsed.repo, repoData.fileTree);

  // --- Step 5a: Text Authenticity (LLM) ---
  const textPrompt = textAuthenticityPrompt(row.aiUsageAnswer, row.aiUsageDescription, row.knownIssues);
  const textResult = await callLLM(textPrompt.system, textPrompt.user);
  const textParsed = parseScoreNote(textResult.content);
  await logLLMCall(row.uid, 'text_authenticity', textResult.model, textResult.inputTokens, textResult.outputTokens, textResult.costUsd);
  totalCost += textResult.costUsd;

  // --- Step 5b: Repo AI-Reliance Analysis (LLM) ---
  const repoPrompt = repoAnalysisPrompt(repoData.commits, repoData.fileTree, repoData.readmeContent, artifactFiles);
  const repoResult = await callLLM(repoPrompt.system, repoPrompt.user);
  const repoParsed = parseScoreNote(repoResult.content);
  await logLLMCall(row.uid, 'repo_analysis', repoResult.model, repoResult.inputTokens, repoResult.outputTokens, repoResult.costUsd);
  totalCost += repoResult.costUsd;

  // --- Step 5c: Project Quality Scoring (LLM) ---
  const scoringPrompt = projectScoringPrompt(row.projectName, repoData.commits, repoData.fileTree, repoData.readmeContent);
  const scoringResult = await callLLM(scoringPrompt.system, scoringPrompt.user);
  const scoringParsed = parseProjectScore(scoringResult.content);
  await logLLMCall(row.uid, 'project_scoring', scoringResult.model, scoringResult.inputTokens, scoringResult.outputTokens, scoringResult.costUsd);
  totalCost += scoringResult.costUsd;

  // --- Step 6: Aggregate ---
  // AI Use Score = average of text authenticity + repo analysis (both already 0-100, higher = more AI-reliant)
  const aiUseScore = Math.round((textParsed.score + repoParsed.score) / 2);
  const level = aiUseLevel(aiUseScore);
  const combinedReason = `Text authenticity: ${textParsed.note} | Repo analysis: ${repoParsed.note}`;

  const manualReview = duplicateFlag !== 'Unique' || level === 'High' || !scoringParsed.voiceGatePassed;

  await upsertSubmission({
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
  });

  await upsertOutputRow({
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
  });

  return { uid: row.uid, status: 'done', costUsd: totalCost };
}
