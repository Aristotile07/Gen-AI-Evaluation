import { NextRequest, NextResponse } from 'next/server';
import { getSubmissionsPaged } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;

  const { rows, total, page, pageSize } = await getSubmissionsPaged({
    page: p.get('page') ? Number(p.get('page')) : 1,
    pageSize: p.get('pageSize') ? Number(p.get('pageSize')) : 25,
    sortKey: p.get('sortKey') || undefined,
    sortDir: (p.get('sortDir') as 'asc' | 'desc') || undefined,
    level: p.get('level') || undefined,
    linkStatus: p.get('linkStatus') || undefined,
    dupStatus: p.get('dupStatus') || undefined,
    search: p.get('search') || undefined,
    from: p.get('from') || undefined,
    to: p.get('to') || undefined,
  });

  return NextResponse.json({ submissions: rows, total, page, pageSize });
}
