'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  parseISO,
  isValid,
} from 'date-fns';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CardsSkeleton, ErrorState } from '@/components/states';
import { CopyButton } from '@/components/copy-button';
import { CallTypeChart, SpendOverTimeChart } from '@/components/cost-charts';
import { fetcher } from '@/lib/fetcher';
import { formatUsd, formatInt, shortId } from '@/lib/utils';
import type { CostSummary } from '@/lib/types';

const OUTLIER_THRESHOLD_USD = 0.05;
const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

function rangeFor(preset: string, customFrom: string, customTo: string) {
  const now = new Date();
  if (preset === 'today') return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (preset === 'week') return { from: subDays(now, 7).toISOString(), to: now.toISOString() };
  if (preset === 'month') return { from: startOfMonth(now).toISOString(), to: now.toISOString() };
  if (preset === 'custom') {
    const f = customFrom ? parseISO(customFrom) : null;
    const t = customTo ? parseISO(customTo) : null;
    if (f && isValid(f) && t && isValid(t)) {
      return { from: startOfDay(f).toISOString(), to: endOfDay(t).toISOString() };
    }
    return null; // incomplete custom range — don't query yet
  }
  return {}; // all time
}

export default function CostsPage() {
  const [preset, setPreset] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const range = useMemo(
    () => rangeFor(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const key =
    range === null
      ? null
      : (() => {
          const p = new URLSearchParams();
          if ('from' in range && range.from) p.set('from', range.from);
          if ('to' in range && range.to) p.set('to', range.to);
          return `/api/costs?${p.toString()}`;
        })();

  const { data, error, isLoading, mutate } = useSWR<CostSummary>(key, fetcher, {
    keepPreviousData: true,
  });

  const outliers = (data?.perProject ?? []).filter(
    (p) => Number(p.total_cost) > OUTLIER_THRESHOLD_USD
  );

  function toggle(uid: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  const projectsEvaluated = Number(data?.summary.projects_evaluated ?? 0);
  const totalCost = Number(data?.summary.total_cost ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader title="API cost" description="LLM spend, per evaluation and overall." />

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            variant={preset === p.key ? 'default' : 'outline'}
            size="sm"
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
      </div>

      {range === null ? (
        <p className="text-sm text-muted-foreground">Pick both dates to see a custom range.</p>
      ) : isLoading && !data ? (
        <CardsSkeleton />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => mutate()} />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total spent (range)" value={formatUsd(totalCost, 4)} />
            <StatCard label="Projects evaluated" value={projectsEvaluated} />
            <StatCard
              label="Avg cost / project"
              value={projectsEvaluated > 0 ? formatUsd(totalCost / projectsEvaluated, 4) : '$0'}
            />
            <StatCard label="Total tokens" value={formatInt(data.summary.total_tokens)} />
          </div>

          {outliers.length > 0 && (
            <div
              role="alert"
              className="rounded-md border border-warn/30 bg-warn-muted p-4 text-sm text-warn"
            >
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {outliers.length} evaluation{outliers.length === 1 ? '' : 's'} cost more than{' '}
                {formatUsd(OUTLIER_THRESHOLD_USD, 2)}
              </div>
              <div className="mt-1.5 space-y-0.5">
                {outliers.map((o) => (
                  <Link
                    key={o.uid}
                    href={`/submissions/${o.uid}`}
                    className="block font-mono text-xs underline-offset-2 hover:underline"
                  >
                    {shortId(o.uid, 12)} — {formatUsd(o.total_cost, 4)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <CallTypeChart data={data.byCallType} />
            <SpendOverTimeChart data={data.spendOverTime ?? []} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Per-project cost</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>UID</TableHead>
                    <TableHead>Text auth</TableHead>
                    <TableHead>Repo analysis</TableHead>
                    <TableHead>Scoring</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.perProject.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No evaluations in this range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.perProject.map((p) => {
                      const open = expanded.has(p.uid);
                      return (
                        <Fragment key={p.uid}>
                          <TableRow className="cursor-pointer" onClick={() => toggle(p.uid)}>
                            <TableCell>
                              {open ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 font-mono text-xs">
                                <Link
                                  href={`/submissions/${p.uid}`}
                                  className="text-accent hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {shortId(p.uid)}
                                </Link>
                                <CopyButton value={p.uid} label="Copy UID" />
                              </span>
                            </TableCell>
                            <TableCell className="tabular-nums">{formatUsd(p.text_auth_cost, 5)}</TableCell>
                            <TableCell className="tabular-nums">{formatUsd(p.repo_analysis_cost, 5)}</TableCell>
                            <TableCell className="tabular-nums">{formatUsd(p.scoring_cost, 5)}</TableCell>
                            <TableCell className="font-medium tabular-nums">{formatUsd(p.total_cost, 5)}</TableCell>
                          </TableRow>
                          {open && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell />
                              <TableCell colSpan={5} className="text-xs text-muted-foreground">
                                Total tokens: <span className="tabular-nums">{formatInt(p.total_tokens)}</span>
                                {p.evaluated_at && <> · last call {new Date(p.evaluated_at).toLocaleString()}</>}
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-right text-xs text-muted-foreground">
            All-time total spend:{' '}
            <span className="font-medium text-foreground">{formatUsd(data.allTimeTotal, 4)}</span>
          </p>
        </>
      ) : null}
    </div>
  );
}
