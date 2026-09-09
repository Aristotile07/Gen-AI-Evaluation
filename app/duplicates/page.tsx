'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { format, isValid } from 'date-fns';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from '@/components/external-link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/states';
import { CopyButton } from '@/components/copy-button';
import { fetcher } from '@/lib/fetcher';
import { shortId } from '@/lib/utils';

interface GroupRow {
  uid: string;
  project_name: string | null;
  timestamp: string | null;
  duplicate_status: string | null;
  processing_status: string | null;
}
interface Group {
  link: string;
  rows: GroupRow[];
  distinct_uids: number;
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return isValid(d) ? format(d, 'dd MMM yyyy, HH:mm') : '—';
}

export default function DuplicatesPage() {
  const { data, error, isLoading, mutate } = useSWR<{ groups: Group[] }>('/api/duplicates', fetcher);
  const groups = data?.groups ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duplicates"
        description="Repos shared by more than one submission. Same-student resubmissions are informational; different-student matches need a human decision."
      />

      {isLoading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => mutate()} />
      ) : groups.length === 0 ? (
        <EmptyState title="No duplicate repos" message="Every submission points to a unique repository." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const realDuplicate = Number(g.distinct_uids) > 1;
            return (
              <Card key={g.link} className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <ExternalLink href={g.link} className="max-w-full text-sm">
                    {g.link}
                  </ExternalLink>
                  <Badge variant={realDuplicate ? 'high' : 'medium'}>
                    {realDuplicate ? 'Duplicate — different students' : 'Resubmission — same student'}
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>UID</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((r) => (
                      <TableRow key={r.uid}>
                        <TableCell>
                          <span className="flex items-center gap-1 font-mono text-xs">
                            <Link href={`/submissions/${r.uid}`} className="text-accent hover:underline">
                              {shortId(r.uid)}
                            </Link>
                            <CopyButton value={r.uid} label="Copy UID" />
                          </span>
                        </TableCell>
                        <TableCell>{r.project_name || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {fmtDate(r.timestamp)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.duplicate_status || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
