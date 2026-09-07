'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LevelBadge from '@/components/LevelBadge';

export default function SubmissionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/submissions')
      .then((r) => r.json())
      .then((d) => {
        setRows(d.submissions || []);
        setLoading(false);
      });
  }, []);

  const projects = Array.from(new Set(rows.map((r) => r.project_name).filter(Boolean)));

  const filtered = rows.filter((r) => {
    if (levelFilter !== 'All' && r.ai_use_level !== levelFilter) return false;
    if (projectFilter !== 'All' && r.project_name !== projectFilter) return false;
    if (search && !`${r.uid} ${r.project_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Submissions</h1>
        <p className="text-sm text-gray-500 mt-1">{filtered.length} of {rows.length} shown</p>
      </div>

      <div className="flex gap-3">
        <input
          placeholder="Search UID or project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm px-3 py-2 border border-gray-300 rounded-md w-64"
        />
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="text-sm px-3 py-2 border border-gray-300 rounded-md">
          <option>All</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
          <option>N/A</option>
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="text-sm px-3 py-2 border border-gray-300 rounded-md">
          <option>All</option>
          {projects.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">UID</th>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Project Score</th>
                <th className="text-left px-4 py-3">AI Use Level</th>
                <th className="text-left px-4 py-3">Link Status</th>
                <th className="text-left px-4 py-3">Duplicate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.uid} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/submissions/${r.uid}`} className="text-accent hover:underline font-mono text-xs">
                      {r.uid.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.project_name}</td>
                  <td className="px-4 py-3">{r.project_score ?? '—'}</td>
                  <td className="px-4 py-3">{r.ai_use_level ? <LevelBadge level={r.ai_use_level} /> : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.link_status}</td>
                  <td className="px-4 py-3 text-gray-500">{r.duplicate_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-sm text-gray-400 p-6 text-center">No submissions match your filters.</p>}
        </div>
      )}
    </div>
  );
}
