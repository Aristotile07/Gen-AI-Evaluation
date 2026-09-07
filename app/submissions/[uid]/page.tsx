'use client';
import { useEffect, useState } from 'react';
import LevelBadge from '@/components/LevelBadge';

export default function SubmissionDetailPage({ params }: { params: { uid: string } }) {
  const [data, setData] = useState<any>(null);
  const [reEvaluating, setReEvaluating] = useState(false);

  useEffect(() => {
    fetch(`/api/submissions/${params.uid}`)
      .then((r) => r.json())
      .then(setData);
  }, [params.uid]);

  async function handleReEvaluate() {
    if (!confirm('This will overwrite the existing evaluation and cost a fresh set of API calls. Continue?')) return;
    setReEvaluating(true);
    const res = await fetch('/api/evaluate/uid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: params.uid, force: true }),
    });
    setReEvaluating(false);
    if (res.ok) window.location.reload();
    else alert('Re-evaluation failed. Check server logs.');
  }

  if (!data) return <p className="text-sm text-gray-400">Loading...</p>;
  if (data.error) return <p className="text-sm text-high">{data.error}</p>;

  const s = data.submission;
  const totalCost = data.llmCalls.reduce((sum: number, c: any) => sum + Number(c.cost_usd), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{s.project_name}</h1>
          <p className="text-sm text-gray-500 font-mono mt-1">{s.uid}</p>
          {s.github_link && (
            <a href={s.github_link} target="_blank" className="text-sm text-accent hover:underline">
              {s.github_link}
            </a>
          )}
        </div>
        <button
          onClick={handleReEvaluate}
          disabled={reEvaluating}
          className="text-sm px-4 py-2 rounded-md bg-ink text-white disabled:opacity-50"
        >
          {reEvaluating ? 'Re-evaluating...' : 'Re-evaluate this submission'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Project Quality</h2>
          <div className="text-3xl font-semibold text-ink mb-1">{s.project_score ?? '—'} / 100</div>
          <div className="text-xs mb-3">
            Voice gate: {s.voice_gate_passed === true ? '✅ Passed' : s.voice_gate_passed === false ? '❌ Failed' : '—'}
          </div>
          <p className="text-sm text-gray-600">{s.project_feedback}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">AI Reliance</h2>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl font-semibold text-ink">{s.ai_use_score ?? '—'} / 100</div>
            {s.ai_use_level && <LevelBadge level={s.ai_use_level} />}
          </div>
          <p className="text-sm text-gray-600">{s.ai_use_reason}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Text Authenticity Note</h2>
          <p className="text-sm text-gray-600">{s.text_authenticity_note || '—'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Repo Analysis Note</h2>
          <p className="text-sm text-gray-600">{s.repo_analysis_note || '—'}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Status</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Link Status: {s.link_status}</p>
          <p>Duplicate Status: {s.duplicate_status}</p>
          <p>Manual Review Needed: {s.manual_review_needed ? 'Yes' : 'No'}</p>
          <p>Processing Status: {s.processing_status}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Evaluation Cost — ${totalCost.toFixed(4)}
        </h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-400 uppercase">
            <tr>
              <th className="text-left py-1">Call Type</th>
              <th className="text-left py-1">Model</th>
              <th className="text-left py-1">Input Tokens</th>
              <th className="text-left py-1">Output Tokens</th>
              <th className="text-left py-1">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.llmCalls.map((c: any, i: number) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-2">{c.call_type}</td>
                <td className="py-2">{c.model_used}</td>
                <td className="py-2">{c.input_tokens}</td>
                <td className="py-2">{c.output_tokens}</td>
                <td className="py-2">${Number(c.cost_usd).toFixed(5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
