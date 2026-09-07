'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function todayRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  return { from, to };
}

function weekRange() {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to: now.toISOString() };
}

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return { from, to: now.toISOString() };
}

const OUTLIER_THRESHOLD_USD = 0.05;

export default function CostsPage() {
  const [preset, setPreset] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let range: { from?: string; to?: string } = {};
    if (preset === 'today') range = todayRange();
    else if (preset === 'week') range = weekRange();
    else if (preset === 'month') range = monthRange();
    else if (preset === 'custom' && customFrom && customTo) range = { from: customFrom, to: customTo };
    else if (preset === 'all') range = {};

    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);

    setLoading(true);
    fetch(`/api/costs?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [preset, customFrom, customTo]);

  const outliers = (data?.perProject || []).filter((p: any) => Number(p.total_cost) > OUTLIER_THRESHOLD_USD);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">API Cost Management</h1>
        <p className="text-sm text-gray-500 mt-1">LLM spend tracking, per evaluation and overall.</p>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        {['today', 'week', 'month', 'all', 'custom'].map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`text-sm px-3 py-1.5 rounded-md border ${
              preset === p ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {p === 'all' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input type="date" onChange={(e) => setCustomFrom(new Date(e.target.value).toISOString())} className="text-sm px-2 py-1 border border-gray-300 rounded-md" />
            <span className="text-sm text-gray-400">to</span>
            <input type="date" onChange={(e) => setCustomTo(new Date(e.target.value).toISOString())} className="text-sm px-2 py-1 border border-gray-300 rounded-md" />
          </>
        )}
      </div>

      {loading || !data ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total $ Spent (selected)" value={`$${Number(data.summary.total_cost).toFixed(4)}`} />
            <StatCard label="Projects Evaluated" value={data.summary.projects_evaluated} />
            <StatCard
              label="Avg Cost / Project"
              value={
                data.summary.projects_evaluated > 0
                  ? `$${(Number(data.summary.total_cost) / Number(data.summary.projects_evaluated)).toFixed(4)}`
                  : '$0'
              }
            />
            <StatCard label="Total Tokens" value={Number(data.summary.total_tokens).toLocaleString()} />
          </div>

          {outliers.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-800">
              ⚠ {outliers.length} evaluation(s) cost more than ${OUTLIER_THRESHOLD_USD} — check if a bloated repo skewed token count.
              {outliers.map((o: any) => (
                <Link key={o.uid} href={`/submissions/${o.uid}`} className="block text-accent hover:underline mt-1">
                  {o.uid} — ${Number(o.total_cost).toFixed(4)}
                </Link>
              ))}
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Breakdown by Call Type</h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 uppercase">
                <tr>
                  <th className="text-left py-1">Call Type</th>
                  <th className="text-left py-1">Calls</th>
                  <th className="text-left py-1">Input Tokens</th>
                  <th className="text-left py-1">Output Tokens</th>
                  <th className="text-left py-1">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.byCallType.map((c: any) => (
                  <tr key={c.call_type} className="border-t border-gray-100">
                    <td className="py-2">{c.call_type}</td>
                    <td className="py-2">{c.calls}</td>
                    <td className="py-2">{Number(c.input_tokens).toLocaleString()}</td>
                    <td className="py-2">{Number(c.output_tokens).toLocaleString()}</td>
                    <td className="py-2">${Number(c.cost).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Per-Project Cost</h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 uppercase">
                <tr>
                  <th className="text-left py-1">UID</th>
                  <th className="text-left py-1">Text Auth</th>
                  <th className="text-left py-1">Repo Analysis</th>
                  <th className="text-left py-1">Scoring</th>
                  <th className="text-left py-1">Total</th>
                  <th className="text-left py-1">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {data.perProject.map((p: any) => (
                  <tr key={p.uid} className="border-t border-gray-100">
                    <td className="py-2">
                      <Link href={`/submissions/${p.uid}`} className="text-accent hover:underline font-mono text-xs">
                        {p.uid.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="py-2">${Number(p.text_auth_cost).toFixed(5)}</td>
                    <td className="py-2">${Number(p.repo_analysis_cost).toFixed(5)}</td>
                    <td className="py-2">${Number(p.scoring_cost).toFixed(5)}</td>
                    <td className="py-2 font-medium">${Number(p.total_cost).toFixed(5)}</td>
                    <td className="py-2 text-gray-500">{Number(p.total_tokens).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-400 text-right">
            All-time total spend: <span className="font-medium text-gray-600">${Number(data.allTimeTotal).toFixed(4)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="text-xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
