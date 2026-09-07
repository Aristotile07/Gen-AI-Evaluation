import { Octokit } from 'octokit';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export interface RepoParseResult {
  status: 'accessible' | 'not_found' | 'not_github' | 'error';
  owner?: string;
  repo?: string;
  errorDetail?: string;
}

// Parses a github.com URL into owner/repo, tolerant of missing https://, trailing .git, trailing slash
export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  let cleaned = url.trim();
  if (!cleaned.startsWith('http')) cleaned = 'https://' + cleaned;
  try {
    const u = new URL(cleaned);
    if (!u.hostname.includes('github.com')) return null;
    const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').replace(/\/$/, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export function isGithubUrl(url: string): boolean {
  return /github\.com/i.test(url || '');
}

export interface RepoData {
  status: 'accessible' | 'not_found' | 'error';
  commits: { date: string; message: string }[];
  fileTree: string[];
  readmeContent: string | null;
  errorDetail?: string;
}

export async function fetchRepoData(owner: string, repo: string): Promise<RepoData> {
  try {
    // Basic existence check
    await octokit.rest.repos.get({ owner, repo });

    // Commit history (first 100, oldest-first not guaranteed by API — we sort ourselves)
    const commitsRes = await octokit.rest.repos.listCommits({ owner, repo, per_page: 100 });
    const commits = commitsRes.data.map((c) => ({
      date: c.commit.author?.date || '',
      message: c.commit.message || '',
    }));

    // File tree (top 2 levels, default branch)
    let fileTree: string[] = [];
    try {
      const repoInfo = await octokit.rest.repos.get({ owner, repo });
      const defaultBranch = repoInfo.data.default_branch;
      const treeRes = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: 'true',
      });
      fileTree = (treeRes.data.tree || [])
        .filter((t) => t.type === 'blob')
        .map((t) => t.path || '')
        .slice(0, 300); // cap for token budget
    } catch {
      // tree fetch can fail on empty repos, ignore
    }

    // README content
    let readmeContent: string | null = null;
    try {
      const readmeRes = await octokit.rest.repos.getReadme({ owner, repo });
      const content = Buffer.from(readmeRes.data.content, 'base64').toString('utf8');
      readmeContent = content.slice(0, 4000); // cap for token budget
    } catch {
      readmeContent = null;
    }

    return { status: 'accessible', commits, fileTree, readmeContent };
  } catch (err: any) {
    if (err.status === 404) {
      return { status: 'not_found', commits: [], fileTree: [], readmeContent: null };
    }
    return {
      status: 'error',
      commits: [],
      fileTree: [],
      readmeContent: null,
      errorDetail: err.message || String(err),
    };
  }
}

// Fetches raw content of specific known "AI artifact" files if present, to feed the analysis prompt
const ARTIFACT_CANDIDATES = [
  'spec.md',
  'SPEC.md',
  'DEPLOY.md',
  'STEP1_COMPLETE.md',
  'STEP2_COMPLETE.md',
  'STEP3_COMPLETE.md',
  'STEP4_COMPLETE.md',
  'STEP5_COMPLETE.md',
  '.oxlintrc.json',
  'CLAUDE.md',
  'AGENTS.md',
];

export async function fetchArtifactFiles(
  owner: string,
  repo: string,
  fileTree: string[]
): Promise<{ path: string; content: string }[]> {
  const found = fileTree.filter((f) =>
    ARTIFACT_CANDIDATES.some((cand) => f.toLowerCase().endsWith(cand.toLowerCase()))
  );
  const results: { path: string; content: string }[] = [];
  for (const path of found.slice(0, 5)) {
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path });
      if ('content' in res.data) {
        const content = Buffer.from(res.data.content, 'base64').toString('utf8').slice(0, 1500);
        results.push({ path, content });
      }
    } catch {
      // skip unreadable file
    }
  }
  return results;
}
