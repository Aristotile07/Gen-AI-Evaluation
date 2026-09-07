import { NextRequest, NextResponse } from 'next/server';
import { getSubmissionByUid } from '@/lib/db';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest, { params }: { params: { uid: string } }) {
  const submission = await getSubmissionByUid(params.uid);
  if (!submission) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const costRes = await sql`
    SELECT call_type, model_used, input_tokens, output_tokens, cost_usd, called_at
    FROM llm_calls WHERE uid = ${params.uid} ORDER BY called_at ASC
  `;
  return NextResponse.json({ submission, llmCalls: costRes.rows });
}
