'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/submissions')
      .then((r) => r.json())
      .then((d) => {
        const rows: any[] = d.submissions || [];
        const grouped: Record<string, any[]> = {};
        for (const r of rows) {
          if (!r.github_link) continue;
          if (!grouped[r.github_link]) grouped[r.github_link] = [];
          grouped[r.github_link].push(r);
        }
        // keep only groups with more than one row
        const filtered = Object.fromEntries(Object.entries(grouped).filter(([, v]) => v.length > 1));
        setGroups(filtered);
        setLoading(false);
      });
  }, []);

  const groupEntries = Object.entries(groups);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Duplicates</h1>
        <p className="text-sm text-gray-500 mt-1">
          Repos shared across multiple UIDs. Same-UID resubmissions are informational; different-UID matches
          need a human decision.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : groupEntries.length === 0 ? (
        <p className="text-sm text-gray-400">No duplicate repos found.</p>
      ) : (
        <div className="space-y-4">
          {groupEntries.map(([link, rows]) => {
            const uids = new Set(rows.map((r) => r.uid));
            const isRealDuplicate = uids.size > 1;
            return (
              <div key={link} className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <a href={link} target="_blank" className="text-sm text-accent hover:underline">{link}</a>
                  <span className={`text-xs px-2 py-1 rounded-full ${isRealDuplicate ? 'badge-high' : 'badge-medium'}`}>
                    {isRealDuplicate ? 'Duplicate — different students' : 'Resubmission — same student'}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400 uppercase">
                    <tr>
                      <th className="text-left py-1">UID</th>
                      <th className="text-left py-1">Timestamp</th>
                      <th className="text-left py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((r) => (
                        <tr key={r.uid} className="border-t border-gray-100">
                          <td className="py-2">
                            <Link href={`/submissions/${r.uid}`} className="text-accent hover:underline font-mono text-xs">
                              {r.uid.slice(0, 8)}...
                            </Link>
                          </td>
                          <td className="py-2 text-gray-500">{new Date(r.timestamp).toLocaleString()}</td>
                          <td className="py-2 text-gray-500">{r.duplicate_status}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
