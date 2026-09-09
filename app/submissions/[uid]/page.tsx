'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ClampedText } from '@/components/clamped-text';
import { CopyButton } from '@/components/copy-button';
import { ExternalLink } from '@/components/external-link';
import { ErrorState } from '@/components/states';
import { Skeleton } from '@/components/ui/skeleton';
import LevelBadge from '@/components/level-badge';
import { fetcher } from '@/lib/fetcher';
import { formatUsd, formatInt, shortId } from '@/lib/utils';
import type { SubmissionDetail } from '@/lib/types';

export default function SubmissionDetailPage({ params }: { params: { uid: string } }) {
  const { data, error, isLoading, mutate } = useSWR<SubmissionDetail>(
    `/api/submissions/${params.uid}`,
    fetcher
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);

  async function reEvaluate() {
    setReEvaluating(true);
    try {
      const res = await fetch('/api/evaluate/uid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: params.uid, force: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Re-evaluation failed');
      toast.success('Re-evaluated', { description: `Cost ${formatUsd(body?.result?.costUsd ?? 0, 5)}` });
      mutate();
    } catch (e) {
      toast.error('Re-evaluation failed', { description: (e as Error).message });
    } finally {
      setReEvaluating(false);
    }
  }

  if (isLoading) return <DetailSkeleton />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => mutate()} />;
  if (!data?.submission) return <ErrorState message="Submission not found." />;

  const s = data.submission;
  const calls = data.llmCalls ?? [];
  const totalCost = calls.reduce((sum, c) => sum + Number(c.cost_usd), 0);
  const otherUid = s.duplicate_of || s.superseded_by;

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.project_name || 'Untitled project'}
        description={undefined}
        actions={
          <Button onClick={() => setConfirmOpen(true)} disabled={reEvaluating} aria-busy={reEvaluating}>
            <RefreshCw className="h-4 w-4" />
            {reEvaluating ? 'Re-evaluating…' : 'Re-evaluate'}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          {shortId(s.uid, 14)}
          <CopyButton value={s.uid} label="Copy UID" />
        </span>
        {s.github_link && <ExternalLink href={s.github_link}>{s.github_link}</ExternalLink>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Project quality</CardTitle>
            {s.voice_gate_passed === true ? (
              <Badge variant="low">Voice gate passed</Badge>
            ) : s.voice_gate_passed === false ? (
              <Badge variant="high">Voice gate failed</Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-semibold tabular-nums">
              {s.project_score ?? '—'}
              <span className="text-base font-normal text-muted-foreground"> / 100</span>
            </div>
            <ClampedText text={s.project_feedback} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>AI reliance</CardTitle>
            {s.ai_use_level && <LevelBadge level={s.ai_use_level} />}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-semibold tabular-nums">
              {s.ai_use_score ?? '—'}
              <span className="text-base font-normal text-muted-foreground"> / 100</span>
            </div>
            <ClampedText text={s.ai_use_reason} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Text authenticity note</CardTitle>
          </CardHeader>
          <CardContent>
            <ClampedText text={s.text_authenticity_note} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Repo analysis note</CardTitle>
          </CardHeader>
          <CardContent>
            <ClampedText text={s.repo_analysis_note} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Link status" value={s.link_status} />
            <Row label="Processing status" value={s.processing_status} />
            <Row
              label="Duplicate status"
              value={
                otherUid ? (
                  <span>
                    {s.duplicate_status}{' '}
                    <Link href={`/submissions/${otherUid}`} className="text-accent hover:underline">
                      → {shortId(otherUid)}
                    </Link>
                  </span>
                ) : (
                  s.duplicate_status
                )
              }
            />
            <Row label="Manual review" value={s.manual_review_needed ? 'Needed' : 'Not needed'} />
            {s.error_detail && <Row label="Error detail" value={s.error_detail} />}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Evaluation cost</CardTitle>
          <span className="text-sm font-semibold tabular-nums">{formatUsd(totalCost, 4)}</span>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No LLM calls recorded for this submission.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Call type</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Input</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{c.call_type}</TableCell>
                    <TableCell className="text-muted-foreground">{c.model_used}</TableCell>
                    <TableCell className="tabular-nums">{formatInt(c.input_tokens)}</TableCell>
                    <TableCell className="tabular-nums">{formatInt(c.output_tokens)}</TableCell>
                    <TableCell className="tabular-nums">{formatUsd(c.cost_usd, 5)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Re-evaluate this submission?"
        description="This overwrites the existing evaluation and spends a fresh set of API calls."
        confirmLabel="Re-evaluate"
        onConfirm={reEvaluate}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value || '—'}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-32" />
    </div>
  );
}
