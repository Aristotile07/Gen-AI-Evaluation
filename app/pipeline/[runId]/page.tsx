'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardsSkeleton, ErrorState } from '@/components/states';
import { PipelineFlow } from '@/components/pipeline-flow';
import { PipelineLogs } from '@/components/pipeline-logs';
import { fetcher } from '@/lib/fetcher';
import { formatUsd } from '@/lib/utils';
import type { EvaluationRunDetail, StepEvent } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  all_new: 'All new',
  specific_count: 'Batch',
  specific_uid: 'Single UID',
};

export default function RunDetailPage({ params }: { params: { runId: string } }) {
  const [uidFilter, setUidFilter] = useState<string>('all');

  const { data, error, isLoading, mutate } = useSWR<{ run: EvaluationRunDetail }>(
    `/api/runs/${params.runId}`,
    fetcher,
    {
      // poll while the run is still going
      refreshInterval: (d) => (d?.run && !d.run.finished_at ? 2000 : 0),
    }
  );

  const run = data?.run;
  const steps: StepEvent[] = useMemo(() => (Array.isArray(run?.steps) ? run!.steps : []), [run]);

  const uids = useMemo(() => {
    const set = new Set<string>();
    for (const s of steps) if (s.uid) set.add(s.uid);
    return [...set];
  }, [steps]);

  const scopedUid = uidFilter === 'all' ? (uids.length === 1 ? uids[0] : undefined) : uidFilter;
  const scopedSteps = uidFilter === 'all' ? steps : steps.filter((s) => s.uid === uidFilter);

  if (isLoading) return <CardsSkeleton count={4} />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => mutate()} />;
  if (!run) return <ErrorState message="Run not found." />;

  const running = !run.finished_at;
  const duration =
    run.finished_at && run.started_at
      ? Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)
      : null;

  return (
    <div className="space-y-6">
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All runs
      </Link>

      <PageHeader
        title={`Run #${run.id}`}
        description={`${TYPE_LABEL[run.run_type] ?? run.run_type} · started ${
          run.started_at ? format(new Date(run.started_at), 'PPpp') : '—'
        }`}
        actions={
          running ? (
            <Badge variant="medium" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Running
            </Badge>
          ) : run.rows_errored > 0 ? (
            <Badge variant="high" className="gap-1">
              <XCircle className="h-3 w-3" /> Had errors
            </Badge>
          ) : (
            <Badge variant="low" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Clean
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Rows processed" value={run.rows_processed} />
        <StatCard
          label="Errored"
          value={run.rows_errored}
          tone={run.rows_errored > 0 ? 'danger' : 'default'}
        />
        <StatCard label="Cost" value={formatUsd(run.total_cost_usd, 4)} />
        <StatCard label="Duration" value={duration != null ? `${duration}s` : running ? '—' : '—'} />
      </div>

      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          {running ? 'Waiting for the first step events…' : 'No step events were recorded for this run.'}
        </div>
      ) : (
        <>
          {uids.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Submission</span>
              <Select value={uidFilter} onValueChange={setUidFilter}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({uids.length})</SelectItem>
                  {uids.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u.slice(0, 16)}…
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Tabs defaultValue="flow">
            <TabsList>
              <TabsTrigger value="flow">Flow</TabsTrigger>
              <TabsTrigger value="logs">
                Logs
                {run.rows_errored > 0 && (
                  <span className="ml-1 rounded-full bg-danger px-1.5 text-[10px] text-danger-foreground">
                    {run.rows_errored}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="flow">
              <PipelineFlow steps={scopedSteps} currentUid={scopedUid} />
            </TabsContent>
            <TabsContent value="logs">
              <PipelineLogs steps={scopedSteps} live={running} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
