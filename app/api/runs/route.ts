import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationRuns } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = Number(new URL(req.url).searchParams.get('limit') ?? 25);
  const runs = await getEvaluationRuns(Number.isFinite(limit) ? limit : 25);
  return NextResponse.json({ runs });
}
