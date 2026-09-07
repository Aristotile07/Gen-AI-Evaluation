import { NextRequest, NextResponse } from 'next/server';
import { readResponseSheet } from '@/lib/sheets';
import { getExistingUids, startEvaluationRun, finishEvaluationRun } from '@/lib/db';
import { evaluateSubmission } from '@/lib/pipeline';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const uid = (body.uid || '').trim();
  const force = !!body.force;

  if (!uid) {
    return NextResponse.json({ success: false, error: 'UID is required' }, { status: 400 });
  }

  const runId = await startEvaluationRun('specific_uid', undefined, uid);

  try {
    const allRows = await readResponseSheet();
    const row = allRows.find((r) => r.uid === uid);

    if (!row) {
      await finishEvaluationRun(runId, 0, 1, 0);
      return NextResponse.json({ success: false, error: `UID ${uid} not found in response sheet` }, { status: 404 });
    }

    const existingUids = await getExistingUids();
    if (existingUids.has(uid) && !force) {
      await finishEvaluationRun(runId, 0, 0, 0);
      return NextResponse.json(
        {
          success: false,
          error: `UID ${uid} already evaluated. Pass force: true to re-evaluate (this will overwrite the existing result).`,
          alreadyEvaluated: true,
        },
        { status: 409 }
      );
    }

    const result = await evaluateSubmission(row, force);
    await finishEvaluationRun(runId, result.status === 'done' ? 1 : 0, result.status === 'error' ? 1 : 0, result.costUsd);

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    await finishEvaluationRun(runId, 0, 1, 0);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
