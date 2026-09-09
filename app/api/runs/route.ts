import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationRuns } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const runs = await getEvaluationRuns({
    limit: p.get('limit') ? Number(p.get('limit')) : undefined,
    from: p.get('from') || undefined,
    to: p.get('to') || undefined,
    type: p.get('type') || undefined,
    status: p.get('status') || undefined,
  });
  return NextResponse.json({ runs });
}
