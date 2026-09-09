import Link from 'next/link';
import { sql } from '@vercel/postgres';
import { AlertTriangle, CopyCheck } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { AiUseDonut, ScoreHistogram, LinkStatusBars } from '@/components/overview-charts';
import { getScoreHistogram } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Overview' };

const LEVEL_ORDER = ['High', 'Medium', 'Low', 'N/A'];

async function getStats() {
  const [total, byStatus, byLevel, byLink, avgScore, manualReview, duplicates, histogram] =
    await Promise.all([
      sql`SELECT COUNT(*)::int AS c FROM submissions`,
      sql`SELECT processing_status, COUNT(*)::int AS c FROM submissions GROUP BY processing_status`,
      sql`SELECT ai_use_level, COUNT(*)::int AS c FROM submissions WHERE ai_use_level IS NOT NULL GROUP BY ai_use_level`,
      sql`SELECT COALESCE(link_status, 'Unknown') AS link_status, COUNT(*)::int AS c FROM submissions GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT AVG(project_score)::float AS avg FROM submissions WHERE project_score IS NOT NULL`,
      sql`SELECT COUNT(*)::int AS c FROM submissions WHERE manual_review_needed = true`,
      sql`SELECT COUNT(*)::int AS c FROM submissions WHERE duplicate_status ILIKE 'Duplicate%'`,
      getScoreHistogram(),
    ]);

  const statusMap: Record<string, number> = {};
  for (const r of byStatus.rows) statusMap[r.processing_status] = r.c;

  const levelMap: Record<string, number> = {};
  for (const r of byLevel.rows) levelMap[r.ai_use_level] = r.c;

  return {
    total: total.rows[0].c as number,
    done: statusMap['Done'] ?? 0,
    pending: statusMap['Pending'] ?? 0,
    errors: statusMap['Error'] ?? 0,
    avgScore: avgScore.rows[0].avg ? Math.round(avgScore.rows[0].avg) : null,
    manualReview: manualReview.rows[0].c as number,
    duplicates: duplicates.rows[0].c as number,
    levelData: LEVEL_ORDER.filter((l) => levelMap[l] != null).map((l) => ({
      level: l,
      count: levelMap[l],
    })),
    linkData: byLink.rows.map((r) => ({ status: r.link_status, count: r.c })),
    histogram,
  };
}

export default async function OverviewPage() {
  let s: Awaited<ReturnType<typeof getStats>>;
  try {
    s = await getStats();
  } catch (err) {
    return (
      <div className="space-y-8">
        <PageHeader title="Overview" description="Snapshot of every evaluated submission." />
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-muted px-6 py-12 text-center text-sm text-danger"
        >
          Could not load overview data — {(err as Error).message || 'database unavailable'}.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" description="Snapshot of every evaluated submission." />

      {(s.manualReview > 0 || s.duplicates > 0) && (
        <div className="flex flex-wrap gap-3">
          {s.manualReview > 0 && (
            <Link
              href="/manual-review"
              className="inline-flex items-center gap-2 rounded-md border border-warn/30 bg-warn-muted px-3 py-2 text-sm text-warn hover:bg-warn/10"
            >
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {s.manualReview} item{s.manualReview === 1 ? '' : 's'} need manual review
            </Link>
          )}
          {s.duplicates > 0 && (
            <Link
              href="/duplicates"
              className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger hover:bg-danger/10"
            >
              <CopyCheck className="h-4 w-4" aria-hidden />
              {s.duplicates} duplicate case{s.duplicates === 1 ? '' : 's'} flagged
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total submissions" value={s.total} />
        <StatCard label="Evaluated" value={s.done} tone={s.done > 0 ? 'ok' : 'default'} />
        <StatCard label="Pending" value={s.pending} tone={s.pending > 0 ? 'warn' : 'default'} />
        <StatCard label="Errors" value={s.errors} tone={s.errors > 0 ? 'danger' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AiUseDonut data={s.levelData} />
        <div className="lg:col-span-2">
          <ScoreHistogram data={s.histogram} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <LinkStatusBars data={s.linkData} />
        <div className="lg:col-span-2">
          <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              label="Avg project score"
              value={s.avgScore ?? '—'}
              hint="Across scored submissions"
            />
            <StatCard
              label="Needs review"
              value={s.manualReview}
              tone={s.manualReview > 0 ? 'warn' : 'default'}
              hint="Manual queue size"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
