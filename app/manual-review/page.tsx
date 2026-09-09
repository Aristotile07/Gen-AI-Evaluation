'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/states';
import LevelBadge from '@/components/level-badge';
import { CopyButton } from '@/components/copy-button';
import { Checkbox } from '@/components/ui/checkbox';
import { fetcher } from '@/lib/fetcher';
import { shortId } from '@/lib/utils';

interface Row {
  uid: string;
  project_name: string | null;
  link_status: string | null;
  duplicate_status: string | null;
  ai_use_level: string | null;
  processing_status: string | null;
  error_detail: string | null;
}

const STORAGE_KEY = 'pe.manualReviewed';

function loadReviewed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function reason(r: Row): string {
  if (r.processing_status === 'Error') return r.error_detail || 'Processing error';
  if (r.link_status && r.link_status !== 'Accessible') return r.link_status;
  if (r.duplicate_status && r.duplicate_status !== 'Unique') return r.duplicate_status;
  if (r.ai_use_level === 'High') return 'High AI-use flag';
  return 'Flagged for review';
}

export default function ManualReviewPage() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<{ rows: Row[] }>('/api/manual-review', fetcher);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  useEffect(() => setReviewed(loadReviewed()), []);

  function toggleReviewed(uid: string) {
    setReviewed((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable — toggle is session-only */
      }
      return next;
    });
  }

  const columns: ColumnDef<Row>[] = [
    {
      id: 'reviewed',
      header: '✓',
      enableSorting: false,
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={reviewed.has(row.original.uid)}
            onCheckedChange={() => toggleReviewed(row.original.uid)}
            aria-label={`Mark ${row.original.project_name ?? row.original.uid} reviewed`}
          />
        </div>
      ),
    },
    {
      accessorKey: 'uid',
      header: 'UID',
      cell: ({ row }) => (
        <span className={`flex items-center gap-1 font-mono text-xs ${reviewed.has(row.original.uid) ? 'opacity-50' : ''}`}>
          <span className="text-accent">{shortId(row.original.uid)}</span>
          <CopyButton value={row.original.uid} label="Copy UID" />
        </span>
      ),
    },
    {
      accessorKey: 'project_name',
      header: 'Project',
      cell: ({ row }) => (
        <span className={reviewed.has(row.original.uid) ? 'opacity-50' : ''}>
          {row.original.project_name || '—'}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground">{reason(row.original)}</span>,
    },
    {
      accessorKey: 'ai_use_level',
      header: 'AI level',
      cell: ({ getValue }) => <LevelBadge level={getValue<string>()} />,
    },
  ];

  const rows = data?.rows ?? [];
  const pending = rows.filter((r) => !reviewed.has(r.uid)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manual review queue"
        description="Submissions the pipeline couldn't confidently decide — deployed-link-only, high AI-use flags, errors, and duplicate cases."
      />

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => mutate()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Queue is clear" message="Nothing needs manual review right now." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {pending} of {rows.length} still to review · checkmarks are local to this browser
          </p>
          <DataTable
            columns={columns}
            data={rows}
            pageSize={25}
            onRowClick={(row) => router.push(`/submissions/${row.uid}`)}
          />
        </>
      )}
    </div>
  );
}
