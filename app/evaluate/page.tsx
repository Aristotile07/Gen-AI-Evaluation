'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/states';
import { fetcher } from '@/lib/fetcher';
import { formatUsd, shortId } from '@/lib/utils';
import type { EvaluationRun } from '@/lib/types';

interface Progress {
  running: boolean;
  done: number;
  total: number;
  errored: number;
  summary?: string;
  ok?: boolean;
}

const IDLE: Progress = { running: false, done: 0, total: 0, errored: 0 };

export default function EvaluatePage() {
  const { data: runsData, mutate: mutateRuns } = useSWR<{ runs: EvaluationRun[] }>(
    '/api/runs',
    fetcher
  );

  const [progress, setProgress] = useState<Progress>(IDLE);
  const [count, setCount] = useState('10');
  const [uid, setUid] = useState('');
  const [force, setForce] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);

  const busy = progress.running;

  async function runStream(url: string, body?: unknown) {
    setProgress({ ...IDLE, running: true });
    let errored = 0;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.body) throw new Error('No response stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'start') {
            setProgress({ running: true, done: 0, total: ev.total, errored: 0 });
          } else if (ev.type === 'progress') {
            if (ev.status === 'error') errored++;
            setProgress((p) => ({ ...p, done: ev.done, total: ev.total, errored }));
          } else if (ev.type === 'done') {
            setProgress({
              running: false,
              done: ev.processed + ev.errored,
              total: ev.total ?? ev.processed + ev.errored,
              errored: ev.errored,
              ok: true,
              summary: `${ev.processed} processed · ${ev.errored} errored · ${formatUsd(
                ev.totalCostUsd,
                4
              )} spent`,
            });
            toast.success('Evaluation run finished');
          } else if (ev.type === 'error') {
            setProgress({ running: false, done: 0, total: 0, errored: 0, ok: false, summary: ev.error });
            toast.error('Run failed', { description: ev.error });
          }
        }
      }
    } catch (e) {
      setProgress({ running: false, done: 0, total: 0, errored: 0, ok: false, summary: (e as Error).message });
      toast.error('Run failed', { description: (e as Error).message });
    } finally {
      mutateRuns();
    }
  }

  async function runUid() {
    if (!uid.trim()) return;
    setProgress({ ...IDLE, running: true });
    try {
      const res = await fetch('/api/evaluate/uid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid.trim(), force }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Evaluation failed');
      setProgress({
        running: false,
        done: 1,
        total: 1,
        errored: body?.result?.status === 'error' ? 1 : 0,
        ok: true,
        summary: `UID ${shortId(uid.trim())} — ${body?.result?.status ?? 'done'} · ${formatUsd(
          body?.result?.costUsd ?? 0,
          5
        )}`,
      });
      toast.success('UID evaluated');
    } catch (e) {
      setProgress({ running: false, done: 0, total: 0, errored: 0, ok: false, summary: (e as Error).message });
      toast.error('Evaluation failed', { description: (e as Error).message });
    } finally {
      mutateRuns();
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Evaluate"
        description="Trigger evaluation runs. Already-evaluated UIDs are skipped unless you force a re-run."
      />

      {(busy || progress.summary) && (
        <Card className={progress.ok === false ? 'border-danger/40' : undefined}>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  {progress.total > 0
                    ? `Processing ${progress.done} of ${progress.total}…`
                    : 'Starting…'}
                </>
              ) : progress.ok === false ? (
                <>
                  <XCircle className="h-4 w-4 text-danger" />
                  Run failed
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-ok" />
                  Run complete
                </>
              )}
            </div>
            {progress.total > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${busy ? pct : 100}%` }}
                />
              </div>
            )}
            {progress.summary && (
              <p className="text-sm text-muted-foreground">{progress.summary}</p>
            )}
            {progress.errored > 0 && busy && (
              <p className="text-xs text-danger">{progress.errored} errored so far</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Evaluate all new</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Processes every unprocessed row in the response sheet.</p>
          <Button onClick={() => runStream('/api/evaluate/all')} disabled={busy} aria-busy={busy}>
            <Play className="h-4 w-4" />
            Evaluate all new
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evaluate a batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Processes the next N unprocessed rows, oldest first.</p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-24"
              aria-label="Batch size"
            />
            <Button
              onClick={() => runStream('/api/evaluate/count', { count: parseInt(count, 10) })}
              disabled={busy}
              aria-busy={busy}
            >
              Evaluate next {count || 'N'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evaluate one UID</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Evaluate a single row. Force overwrites an existing result.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Paste UID…"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              className="min-w-[240px] flex-1"
              aria-label="UID"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={force} onCheckedChange={(v) => setForce(!!v)} />
              Force re-evaluate
            </label>
            <Button
              onClick={() => (force ? setConfirmForce(true) : runUid())}
              disabled={busy || !uid.trim()}
              aria-busy={busy}
            >
              Evaluate UID
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
        </CardHeader>
        <CardContent>
          {!runsData ? (
            <TableSkeleton rows={4} cols={5} />
          ) : runsData.runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Errored</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsData.runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.started_at
                        ? formatDistanceToNow(new Date(r.started_at), { addSuffix: true })
                        : '—'}
                      {!r.finished_at && <span className="ml-2 text-warn">running</span>}
                    </TableCell>
                    <TableCell>{r.run_type.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="tabular-nums">{r.rows_processed}</TableCell>
                    <TableCell className={`tabular-nums ${r.rows_errored > 0 ? 'text-danger' : ''}`}>
                      {r.rows_errored}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatUsd(r.total_cost_usd, 4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmForce}
        onOpenChange={setConfirmForce}
        title="Force re-evaluate this UID?"
        description="This overwrites the existing result and spends a fresh set of API calls."
        confirmLabel="Force re-evaluate"
        destructive
        onConfirm={runUid}
      />
    </div>
  );
}
