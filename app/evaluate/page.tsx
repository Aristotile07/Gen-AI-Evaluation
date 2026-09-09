'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/states';
import { RunControls } from '@/components/run-controls';
import { useEvaluationRun } from '@/lib/use-evaluation-run';
import { fetcher } from '@/lib/fetcher';
import { formatUsd } from '@/lib/utils';
import type { EvaluationRun } from '@/lib/types';

export default function EvaluatePage() {
  const { progress, start } = useEvaluationRun();
  const { data: runsData, mutate: mutateRuns } = useSWR<{ runs: EvaluationRun[] }>(
    '/api/runs?limit=5',
    fetcher
  );

  const busy = progress.running;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  async function handleRun(req: Parameters<typeof start>[0]) {
    await start(req);
    mutateRuns();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Evaluate"
        description="Trigger evaluation runs. Watch the full step-by-step flow on the Pipeline tab."
        actions={
          <Link
            href="/pipeline"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            Pipeline & run history →
          </Link>
        }
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
                  <XCircle className="h-4 w-4 text-danger" /> Run failed
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-ok" /> Run complete
                </>
              )}
              {progress.runId && (
                <Link
                  href={`/pipeline/${progress.runId}`}
                  className="text-xs text-accent hover:underline"
                >
                  view flow & logs →
                </Link>
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
            {progress.summary && <p className="text-sm text-muted-foreground">{progress.summary}</p>}
          </CardContent>
        </Card>
      )}

      <RunControls onRun={handleRun} disabled={busy} />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent runs</CardTitle>
          <Link href="/pipeline" className="text-xs text-accent hover:underline">
            See all →
          </Link>
        </CardHeader>
        <CardContent>
          {!runsData ? (
            <TableSkeleton rows={3} cols={4} />
          ) : runsData.runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
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
                  <TableRow key={r.id} className="cursor-pointer">
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      <Link href={`/pipeline/${r.id}`} className="hover:text-foreground hover:underline">
                        {r.started_at
                          ? formatDistanceToNow(new Date(r.started_at), { addSuffix: true })
                          : '—'}
                        {!r.finished_at && <span className="ml-2 text-warn">running</span>}
                      </Link>
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
    </div>
  );
}
