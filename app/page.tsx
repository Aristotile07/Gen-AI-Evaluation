import { sql } from '@vercel/postgres';
import LevelBadge from '@/components/LevelBadge';
import Link from 'next/link';

async function getStats() {
  const total = await sql`SELECT COUNT(*) FROM submissions`;
  const byStatus = await sql`SELECT processing_status, COUNT(*) FROM submissions GROUP BY processing_status`;
  const byLevel = await sql`SELECT ai_use_level, COUNT(*) FROM submissions WHERE ai_use_level IS NOT NULL GROUP BY ai_use_level`;
  const byLink = await sql`SELECT link_status, COUNT(*) FROM submissions GROUP BY link_status`;
  const avgScore = await sql`SELECT AVG(project_score) as avg FROM submissions WHERE project_score IS NOT NULL`;
  const manualReviewCount = await sql`SELECT COUNT(*) FROM submissions WHERE manual_review_needed = true`;
  const duplicateCount = await sql`SELECT COUNT(*) FROM submissions WHERE duplicate_status LIKE 'Duplicate%'`;

  return {
    total: Number(total.rows[0].count),
    byStatus: byStatus.rows,
    byLevel: byLevel.rows,
    byLink: byLink.rows,
    avgScore: avgScore.rows[0].avg ? Math.round(avgScore.rows[0].avg) : null,
    manualReviewCount: Number(manualReviewCount.rows[0].count),
    duplicateCount: Number(duplicateCount.rows[0].count),
  };
}

export default async function OverviewPage() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Snapshot of all evaluated submissions.</p>
      </div>

      {(stats.manualReviewCount > 0 || stats.duplicateCount > 0) && (
        <div className="flex gap-3">
          {stats.manualReviewCount > 0 && (
            <Link
              href="/manual-review"
              className="text-sm px-4 py-2 rounded-md bg-medium/10 text-medium border border-medium/30"
            >
              ⚠ {stats.manualReviewCount} items need manual review
            </Link>
          )}
          {stats.duplicateCount > 0 && (
            <Link href="/duplicates" className="text-sm px-4 py-2 rounded-md bg-high/10 text-high border border-high/30">
              ⧉ {stats.duplicateCount} duplicate cases flagged
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Submissions" value={stats.total} />
        <StatCard label="Evaluated" value={stats.byStatus.find((s) => s.processing_status === 'Done')?.count ?? 0} />
        <StatCard label="Errors" value={stats.byStatus.find((s) => s.processing_status === 'Error')?.count ?? 0} />
        <StatCard label="Avg Project Score" value={stats.avgScore ?? '—'} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">AI Use Level Breakdown</h2>
          <div className="space-y-2">
            {stats.byLevel.map((r) => (
              <div key={r.ai_use_level} className="flex items-center justify-between">
                <LevelBadge level={r.ai_use_level} />
                <span className="text-sm text-gray-600">{r.count}</span>
              </div>
            ))}
            {stats.byLevel.length === 0 && <p className="text-sm text-gray-400">No data yet.</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Link Status Breakdown</h2>
          <div className="space-y-2">
            {stats.byLink.map((r) => (
              <div key={r.link_status} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{r.link_status}</span>
                <span className="text-gray-500">{r.count}</span>
              </div>
            ))}
            {stats.byLink.length === 0 && <p className="text-sm text-gray-400">No data yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
