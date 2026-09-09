'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { format, formatDistanceToNow } from 'date-fns';
import { Loader2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/states';
import { RunControls } from '@/components/run-controls';
import { PipelineFlow } from '@/components/pipeline-flow';
import { PipelineLogs } from '@/components/pipeline-logs';
import { useEvaluationRun } from '@/lib/use-evaluation-run';
import { fetcher } from '@/lib/fetcher';
import { formatUsd } from '@/lib/utils';
import { RANGE_PRESETS, resolveRange, rangeToQuery, type RangePreset } from '@/lib/date-ranges';
import type { EvaluationRun } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  all_new: 'All new',
  specific_count: 'Batch',
  specific_uid: 'Single UID',
};

function runStatus(r: EvaluationRun): { label: string; variant: 'low' | 'high' | 'medium' } {
  if (!r.finished_at) return { label: 'Running', variant: 'medium' };
  if (r.rows_errored > 0) return { label: 'Had errors', variant: 'high' };
  return { label: 'Clean', variant: 'low' };
}

export default function PipelinePage() {
  const router = useRouter();
  const { progress, steps, start, reset } = useEvaluationRun();

  const [preset, setPreset] = useState<RangePreset>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [showRunner, setShowRunner] = useState(false);

  const range = useMemo(
    () => resolveRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const key = useMemo(() => {
    if (range === null) return null;
    const p = rangeToQuery(range);
    if (type !== 'all') p.set('type', type);
    if (status !== 'all') p.set('status', status);
    return `/api/runs?${p.toString()}`;
  }, [range, type, status]);

  const { data, error, isLoading, mutate } = useSWR<{ runs: EvaluationRun[] }>(key, fetcher, {
    keepPreviousData: true,
    refreshInterval: 5000, // keep the list fresh while a run is going
  });

  const busy = progress.running;
  const runs = data?.runs ?? [];

  async function handleRun(req: Parameters<typeof start>[0]) {
    setShowRunner(true);
    await start(req);
    mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Every evaluation run, with its full step-by-step flow and logs."
        actions={
          <Button
            variant={showRunner ? 'outline' : 'default'}
            onClick={() => {
              reset();
              setShowRunner((v) => !v);
            }}
          >
            {showRunner ? 'Hide runner' : 'Run now'}
          </Button>
        }
      />

      {showRunner && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
          <RunControls onRun={handleRun} disabled={busy} />

          {(busy || steps.length > 0 || progress.summary) && (
            <>
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
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => router.push(`/pipeline/${progress.runId}`)}
                  >
                    open run #{progress.runId}
                  </Button>
                )}
              </div>
              {progress.summary && (
                <p className="text-sm text-muted-foreground">{progress.summary}</p>
              )}

              <Tabs defaultValue="flow">
                <TabsList>
                  <TabsTrigger value="flow">Flow</TabsTrigger>
                  <TabsTrigger value="logs">
                    Logs
                    {progress.errored > 0 && (
                      <span className="ml-1 rounded-full bg-danger px-1.5 text-[10px] text-danger-foreground">
                        {progress.errored}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="flow">
                  <PipelineFlow steps={steps} currentUid={progress.currentUid} />
                </TabsContent>
                <TabsContent value="logs">
                  <PipelineLogs steps={steps} live={busy} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      )}

      {/* --- history browser --- */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={preset === p.key ? 'default' : 'outline'}
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-40"
              aria-label="From date"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-40"
              aria-label="To date"
            />
          </div>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <FilterSelect
          value={type}
          onChange={setType}
          options={[
            ['all', 'All types'],
            ['all_new', 'All new'],
            ['specific_count', 'Batch'],
            ['specific_uid', 'Single UID'],
          ]}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            ['all', 'Any status'],
            ['running', 'Running'],
            ['clean', 'Clean'],
            ['error', 'Had errors'],
          ]}
        />
      </div>

      {range === null ? (
        <p className="text-sm text-muted-foreground">Pick both dates for a custom range.</p>
      ) : isLoading && !data ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => mutate()} />
      ) : runs.length === 0 ? (
        <EmptyState title="No runs in this range" message="Trigger one with “Run now”, or widen the date filter." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Errored</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => {
                const st = runStatus(r);
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/pipeline/${r.id}`)}
                  >
                    <TableCell className="whitespace-nowrap">
                      <span title={r.started_at ? format(new Date(r.started_at), 'PPpp') : ''}>
                        {r.started_at
                          ? formatDistanceToNow(new Date(r.started_at), { addSuffix: true })
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {TYPE_LABEL[r.run_type] ?? r.run_type}
                      {r.run_type === 'specific_count' && r.requested_count != null && (
                        <span className="text-muted-foreground"> ×{r.requested_count}</span>
                      )}
                      {r.run_type === 'specific_uid' && r.requested_uid && (
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          {r.requested_uid.slice(0, 6)}…
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{r.rows_processed}</TableCell>
                    <TableCell className={`tabular-nums ${r.rows_errored > 0 ? 'text-danger' : ''}`}>
                      {r.rows_errored}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatUsd(r.total_cost_usd, 4)}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
