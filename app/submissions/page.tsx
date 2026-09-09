'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { ColumnDef, SortingState, PaginationState } from '@tanstack/react-table';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { TableSkeleton, ErrorState } from '@/components/states';
import LevelBadge from '@/components/level-badge';
import { CopyButton } from '@/components/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetcher } from '@/lib/fetcher';
import { shortId } from '@/lib/utils';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { Submission, SubmissionsPage } from '@/lib/types';

const PAGE_SIZE = 25;
const SORT_KEYS = ['uid', 'project_name', 'project_score', 'ai_use_score', 'ai_use_level', 'link_status', 'evaluated_at'];

export default function SubmissionsPage() {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All');
  const [linkStatus, setLinkStatus] = useState('All');
  const [dupStatus, setDupStatus] = useState('All');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'evaluated_at', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [exporting, setExporting] = useState(false);

  const sort = sorting[0];
  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(pagination.pageIndex + 1));
    p.set('pageSize', String(PAGE_SIZE));
    if (sort && SORT_KEYS.includes(sort.id)) {
      p.set('sortKey', sort.id);
      p.set('sortDir', sort.desc ? 'desc' : 'asc');
    }
    if (search.trim()) p.set('search', search.trim());
    if (level !== 'All') p.set('level', level);
    if (linkStatus !== 'All') p.set('linkStatus', linkStatus);
    if (dupStatus !== 'All') p.set('dupStatus', dupStatus);
    return p.toString();
  }, [pagination.pageIndex, sort, search, level, linkStatus, dupStatus]);

  const { data, error, isLoading, mutate } = useSWR<SubmissionsPage>(
    `/api/submissions?${query}`,
    fetcher,
    { keepPreviousData: true }
  );

  // Any filter change resets to the first page.
  function resetPage() {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  const columns: ColumnDef<Submission>[] = [
    {
      accessorKey: 'uid',
      header: 'UID',
      cell: ({ row }) => (
        <span className="flex items-center gap-1 font-mono text-xs">
          <span className="text-accent">{shortId(row.original.uid)}</span>
          <CopyButton value={row.original.uid} label="Copy UID" />
        </span>
      ),
    },
    { accessorKey: 'project_name', header: 'Project', cell: ({ getValue }) => getValue<string>() || '—' },
    {
      accessorKey: 'project_score',
      header: 'Score',
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return v == null ? '—' : <span className="tabular-nums">{v}</span>;
      },
    },
    {
      accessorKey: 'ai_use_level',
      header: 'AI level',
      cell: ({ getValue }) => <LevelBadge level={getValue<string>()} />,
    },
    {
      accessorKey: 'ai_use_score',
      header: 'AI score',
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return v == null ? '—' : <span className="tabular-nums">{v}</span>;
      },
    },
    {
      accessorKey: 'link_status',
      header: 'Link',
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>() || '—'}</span>,
    },
    {
      accessorKey: 'duplicate_status',
      header: 'Duplicate',
      enableSorting: false,
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>() || '—'}</span>,
    },
    {
      accessorKey: 'evaluated_at',
      header: 'Evaluated',
      cell: ({ getValue }) => {
        const v = getValue<string | null>();
        return v ? (
          <span className="whitespace-nowrap text-muted-foreground">
            {format(new Date(v), 'dd MMM, HH:mm')}
          </span>
        ) : (
          '—'
        );
      },
    },
  ];

  async function exportCsv() {
    setExporting(true);
    try {
      const p = new URLSearchParams(query);
      p.set('page', '1');
      p.set('pageSize', '10000');
      const all = await fetcher<SubmissionsPage>(`/api/submissions?${p.toString()}`);
      const csv = toCsv(all.submissions, [
        { header: 'UID', value: (r) => r.uid },
        { header: 'Project', value: (r) => r.project_name },
        { header: 'Project Score', value: (r) => r.project_score },
        { header: 'AI Use Level', value: (r) => r.ai_use_level },
        { header: 'AI Use Score', value: (r) => r.ai_use_score },
        { header: 'Link Status', value: (r) => r.link_status },
        { header: 'Duplicate Status', value: (r) => r.duplicate_status },
        { header: 'Voice Gate Passed', value: (r) => r.voice_gate_passed },
        { header: 'Evaluated At', value: (r) => r.evaluated_at },
      ]);
      downloadCsv(`submissions-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`, csv);
      toast.success(`Exported ${all.submissions.length} rows`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submissions"
        description={data ? `${total} evaluated submission${total === 1 ? '' : 's'}` : 'The main working table.'}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting || total === 0}>
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search UID or project…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          className="w-56"
          aria-label="Search submissions"
        />
        <FilterSelect
          label="AI level"
          value={level}
          onChange={(v) => {
            setLevel(v);
            resetPage();
          }}
          options={['All', 'High', 'Medium', 'Low', 'N/A']}
        />
        <FilterSelect
          label="Link status"
          value={linkStatus}
          onChange={(v) => {
            setLinkStatus(v);
            resetPage();
          }}
          options={[
            'All',
            'Accessible',
            'Not Reached (404)',
            'No Link Provided',
            'Deployed Link Only (Manual Review)',
            'Error',
          ]}
        />
        <FilterSelect
          label="Duplicate"
          value={dupStatus}
          onChange={(v) => {
            setDupStatus(v);
            resetPage();
          }}
          options={[
            { value: 'All', label: 'All' },
            { value: 'unique', label: 'Unique only' },
            { value: 'duplicate', label: 'Duplicates' },
            { value: 'resubmission', label: 'Resubmissions' },
          ]}
        />
      </div>

      {isLoading && !data ? (
        <TableSkeleton rows={8} cols={8} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => mutate()} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.submissions ?? []}
          manual
          pageCount={pageCount}
          sorting={sorting}
          onSortingChange={setSorting}
          pagination={pagination}
          onPaginationChange={setPagination}
          onRowClick={(row) => router.push(`/submissions/${row.uid}`)}
          emptyMessage="No submissions match your filters."
        />
      )}
    </div>
  );
}

type Opt = string | { value: string; label: string };

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
}) {
  const norm = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-[9rem]" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {norm.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
