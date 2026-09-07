// Prompts for the 3 LLM judgment calls in the pipeline.
// Kept as plain template functions so they're easy to tune later without touching pipeline logic.

const RUBRICS: Record<string, string> = {
  'Voice FAQ Bot': `
MANDATORY GATE: Voice input (mic/upload) works AND voice output (TTS) works. If either is missing, voice_gate_passed = false and type-specific score is capped at 10/50 regardless of other checks.
1. Real knowledge base actually queried, not hardcoded if-else (10 pts)
2. Retrieval finds relevant answers to varied phrasings, not just exact string match (10 pts)
3. Transcription accuracy reasonable (10 pts)
4. Handles no-match case gracefully (10 pts)
5. Overall FAQ loop works end-to-end (10 pts)
`.trim(),
  'Meeting Insights Dashboard': `
MANDATORY GATE: Voice input (audio recording) works AND voice output (spoken summary/insights read back) works. If either is missing, voice_gate_passed = false and type-specific score is capped at 10/50.
1. Speaker diarization present and reasonably accurate (10 pts)
2. Extracts structured summary, not raw transcript dump (10 pts)
3. Extracts actionable items/decisions distinctly (10 pts)
4. Dashboard UI visualizes the above (10 pts)
5. Overall pipeline works end-to-end (10 pts)
`.trim(),
  'Voice Notes -> Action Items': `
MANDATORY GATE: Voice input works AND voice output (spoken confirmation/readback of action items) works. If either is missing, voice_gate_passed = false and type-specific score is capped at 10/50.
1. Correctly identifies action items from natural speech (10 pts)
2. Action items structured (task + owner/deadline if mentioned) (10 pts)
3. Output usable (list, exportable) (10 pts)
4. Handles no-action-item notes gracefully (10 pts)
5. Overall pipeline works end-to-end (10 pts)
`.trim(),
  'Real-Time Voice Assistant': `
MANDATORY GATE: Voice input (mic) works AND voice output (TTS) works. If either is missing, voice_gate_passed = false and type-specific score is capped at 10/50.
1. Wake word or clear trigger mechanism (10 pts)
2. LLM response relevant and coherent, not generic fallback (10 pts)
3. Response latency reasonable, not 30+ sec (10 pts)
4. Handles multiple distinct query types (10 pts)
5. Overall assistant works end-to-end (10 pts)
`.trim(),
  'AI Voice Language Tutor': `
MANDATORY GATE: Voice input works AND voice output (spoken feedback) works. If either is missing, voice_gate_passed = false and type-specific score is capped at 10/50.
1. Actual grammar/pronunciation feedback, not generic praise (10 pts)
2. Feedback specific to what was said (10 pts)
3. Some progression/difficulty adaptation across session (10 pts)
4. Consistent language/target focus (10 pts)
5. Overall tutor loop works end-to-end (10 pts)
`.trim(),
};

export function getRubricForProject(projectName: string): string {
  // tolerant matching in case of minor label variance (arrow vs dash etc.)
  const normalized = projectName.trim();
  if (RUBRICS[normalized]) return RUBRICS[normalized];
  const key = Object.keys(RUBRICS).find((k) =>
    normalized.toLowerCase().includes(k.toLowerCase().split(' ')[0])
  );
  return key ? RUBRICS[key] : RUBRICS['Voice FAQ Bot'];
}

export function textAuthenticityPrompt(aiUsageAnswer: string, description: string, knownIssues: string) {
  const system = `You are evaluating whether a student's free-text form answers about their own project sound genuinely human-written and specific, versus generic, templated, or copy-pasted AI output. You are NOT judging whether they used AI tools (that's a separate check) — you are judging the AUTHENTICITY of their writing style: specificity, personal detail, natural imperfection, versus vague/generic/overly polished templated phrasing.

Respond ONLY in this exact format, nothing else:
SCORE: <0-100, higher = more likely templated/AI-generated text, lower = more likely genuine human writing>
NOTE: <one or two sentences explaining why>`;

  const user = `Did you use AI coding assistants (form answer): ${aiUsageAnswer}

AI usage description (free text): """${description}"""

Known issues / improvements (free text): """${knownIssues}"""`;

  return { system, user };
}

export function repoAnalysisPrompt(
  commits: { date: string; message: string }[],
  fileTree: string[],
  readmeContent: string | null,
  artifactFiles: { path: string; content: string }[]
) {
  const system = `You are analyzing a student's GitHub repository to judge how likely it is that the project was built primarily by an AI coding agent with minimal student understanding/iteration, versus genuine iterative human development (possibly AI-assisted, which is fine and expected).

Signals that suggest HIGH AI-reliance:
- Entire project delivered in a single commit, especially messages like "Initial commit", "Add files via upload", or a fully-featured commit message describing a complete system
- Commit timeline far too short for the complexity delivered (e.g., a full-stack app with multiple integrations in under 30 minutes)
- Leftover AI-agent artifact files: spec.md/SPEC.md addressed to an AI agent, STEP*_COMPLETE.md progress logs, DEPLOY.md, CLAUDE.md, AGENTS.md, .oxlintrc.json (a specific AI-scaffold config)
- Deletion of such artifact files right before what looks like a final/submission commit (attempt to hide AI tooling trail)

Signals that suggest LOW AI-reliance (genuine iteration):
- Many commits over a realistic timespan (hours to days) with incremental, specific messages
- Evidence of debugging back-and-forth (revert commits, fix commits following feature commits)
- File-by-file granular commits matching a natural build order

Respond ONLY in this exact format, nothing else:
SCORE: <0-100, higher = more likely AI-agent-built with minimal human involvement>
NOTE: <two to three sentences citing the specific evidence found>`;

  const commitSummary = commits
    .slice(0, 50)
    .map((c) => `${c.date} | ${c.message.split('\n')[0]}`)
    .join('\n');

  const artifactSummary = artifactFiles.length
    ? artifactFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')
    : 'None found.';

  const user = `COMMIT HISTORY (up to 50, most recent first):
${commitSummary || 'No commits found.'}

FILE TREE (partial):
${fileTree.slice(0, 100).join('\n') || 'Empty or unavailable.'}

README CONTENT:
${readmeContent || 'No README found.'}

SUSPICIOUS ARTIFACT FILES FOUND IN REPO:
${artifactSummary}`;

  return { system, user };
}

export function projectScoringPrompt(
  projectName: string,
  commits: { date: string; message: string }[],
  fileTree: string[],
  readmeContent: string | null
) {
  const rubric = getRubricForProject(projectName);

  const system = `You are grading a student project's quality against a fixed rubric. Score out of 100 total: 50 points generic criteria (all project types), 50 points type-specific criteria (given below). Be strict but fair — base your judgment ONLY on what's visible in the README, file structure, and commit messages provided (you do not have direct code execution access), and say so if you can't confirm something functions.

GENERIC CRITERIA (50 pts):
- Code quality & structure: readable, organized, no obvious dead code (15 pts)
- Completeness: no placeholder/TODO left uncompleted, appears runnable (15 pts)
- Documentation: README explains setup, usage, architecture (10 pts)
- Deployment readiness: deployed link present/working OR clear local setup instructions (10 pts)

TYPE-SPECIFIC CRITERIA for "${projectName}" (50 pts):
${rubric}

Respond ONLY in this exact format, nothing else:
SCORE: <0-100 total>
VOICE_GATE: <PASS or FAIL>
FEEDBACK: <3-4 sentences: what's working, what's missing, and why you scored it this way>`;

  const commitSummary = commits
    .slice(0, 30)
    .map((c) => `${c.date} | ${c.message.split('\n')[0]}`)
    .join('\n');

  const user = `PROJECT TYPE: ${projectName}

FILE TREE (partial):
${fileTree.slice(0, 150).join('\n') || 'Empty or unavailable.'}

README CONTENT:
${readmeContent || 'No README found.'}

COMMIT HISTORY (up to 30, most recent first):
${commitSummary || 'No commits found.'}`;

  return { system, user };
}

// Parses the strict "SCORE: X\nNOTE: ..." style response
export function parseScoreNote(raw: string): { score: number; note: string } {
  const scoreMatch = raw.match(/SCORE:\s*(\d+)/i);
  const noteMatch = raw.match(/NOTE:\s*([\s\S]*)/i);
  return {
    score: scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 50,
    note: noteMatch ? noteMatch[1].trim() : raw.trim(),
  };
}

export function parseProjectScore(raw: string): {
  score: number;
  voiceGatePassed: boolean;
  feedback: string;
} {
  const scoreMatch = raw.match(/SCORE:\s*(\d+)/i);
  const gateMatch = raw.match(/VOICE_GATE:\s*(PASS|FAIL)/i);
  const feedbackMatch = raw.match(/FEEDBACK:\s*([\s\S]*)/i);
  return {
    score: scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 0,
    voiceGatePassed: gateMatch ? gateMatch[1].toUpperCase() === 'PASS' : false,
    feedback: feedbackMatch ? feedbackMatch[1].trim() : raw.trim(),
  };
}
