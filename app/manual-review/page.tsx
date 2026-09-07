'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LevelBadge from '@/components/LevelBadge';

export default function ManualReviewPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/submissions')
      .then((r) => r.json())
      .then((d) => {
        setRows((d.submissions || []).filter((r: any) => r.manual_review_needed));
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Manual Review Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Submissions the pipeline couldn't confidently decide on — deployed-link-only, high AI-use flags,
          errors, or duplicate cases.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing needs manual review right now.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">UID</th>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Reason</th>
                <th className="text-left px-4 py-3">AI Use Level</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.uid} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/submissions/${r.uid}`} className="text-accent hover:underline font-mono text-xs">
                      {r.uid.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.project_name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {r.link_status !== 'Accessible' ? r.link_status : r.duplicate_status !== 'Unique' ? r.duplicate_status : 'High AI-use flag'}
                  </td>
                  <td className="px-4 py-3">{r.ai_use_level ? <LevelBadge level={r.ai_use_level} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
