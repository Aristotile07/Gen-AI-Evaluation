import { NextRequest, NextResponse } from 'next/server';
import { getCostSummary } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('from') || undefined;
  const dateTo = searchParams.get('to') || undefined;
  const data = await getCostSummary(dateFrom, dateTo);
  return NextResponse.json(data);
}
