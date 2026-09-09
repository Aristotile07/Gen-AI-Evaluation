import { NextResponse } from 'next/server';
import { getManualReviewRows } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await getManualReviewRows();
  return NextResponse.json({ rows });
}
