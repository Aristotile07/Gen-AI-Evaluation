'use client';
import { useState } from 'react';

export default function EvaluatePage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [count, setCount] = useState('10');
  const [uid, setUid] = useState('');
  const [force, setForce] = useState(false);

  async function runAll() {
    setRunning(true);
    setResult(null);
    const res = await fetch('/api/evaluate/all', { method: 'POST' });
    const data = await res.json();
    setResult(data);
    setRunning(false);
  }

  async function runCount() {
    setRunning(true);
    setResult(null);
    const res = await fetch('/api/evaluate/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: parseInt(count, 10) }),
    });
    const data = await res.json();
    setResult(data);
    setRunning(false);
  }

  async function runUid() {
    if (!uid.trim()) return;
    setRunning(true);
    setResult(null);
    const res = await fetch('/api/evaluate/uid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: uid.trim(), force }),
    });
    const data = await res.json();
    setResult(data);
    setRunning(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Evaluate</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manually trigger evaluation runs. Already-evaluated UIDs are always skipped unless you force
          re-evaluate a specific one.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Evaluate All New</h2>
        <p className="text-xs text-gray-500">Processes every unprocessed row in the response sheet.</p>
        <button
          onClick={runAll}
          disabled={running}
          className="text-sm px-4 py-2 rounded-md bg-ink text-white disabled:opacity-50"
        >
          {running ? 'Running...' : 'Evaluate All New'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Evaluate Specific Count</h2>
        <p className="text-xs text-gray-500">Processes the next N unprocessed rows, oldest first. Good for test batches.</p>
        <div className="flex gap-2">
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="text-sm px-3 py-2 border border-gray-300 rounded-md w-24"
            min={1}
          />
          <button
            onClick={runCount}
            disabled={running}
            className="text-sm px-4 py-2 rounded-md bg-ink text-white disabled:opacity-50"
          >
            {running ? 'Running...' : `Evaluate Next ${count}`}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Evaluate Specific UID</h2>
        <p className="text-xs text-gray-500">Evaluate one row by UID. Check "Force" to overwrite an existing result.</p>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            placeholder="Paste UID..."
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            className="text-sm px-3 py-2 border border-gray-300 rounded-md flex-1 min-w-[240px]"
          />
          <label className="text-xs text-gray-600 flex items-center gap-1">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Force re-evaluate
          </label>
          <button
            onClick={runUid}
            disabled={running}
            className="text-sm px-4 py-2 rounded-md bg-ink text-white disabled:opacity-50"
          >
            {running ? 'Running...' : 'Evaluate UID'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Last Run Result</h3>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
