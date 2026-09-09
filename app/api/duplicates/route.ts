import { NextResponse } from 'next/server';
import { getDuplicateGroups } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const groups = await getDuplicateGroups();
  return NextResponse.json({ groups });
}
