import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationRun } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  }
  const run = await getEvaluationRun(id);
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }
  return NextResponse.json({ run });
}
