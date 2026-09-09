import { NextRequest, NextResponse } from 'next/server';
import { readResponseSheet } from '@/lib/sheets';
import {
  getExistingUids,
  startEvaluationRun,
  finishEvaluationRun,
  updateRunSteps,
} from '@/lib/db';
import { evaluateSubmission } from '@/lib/pipeline';
import type { StepEvent } from '@/lib/pipeline-steps';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const uid = (body.uid || '').trim();
  const force = !!body.force;

  if (!uid) {
    return NextResponse.json({ success: false, error: 'UID is required' }, { status: 400 });
  }

  const runId = await startEvaluationRun('specific_uid', undefined, uid);
  const steps: StepEvent[] = [];
  const onStep = (e: StepEvent) => steps.push(e);

  try {
    const allRows = await readResponseSheet();
    const row = allRows.find((r) => r.uid === uid);

    if (!row) {
      await finishEvaluationRun(runId, 0, 1, 0);
      return NextResponse.json({ success: false, error: `UID ${uid} not found in response sheet`, runId }, { status: 404 });
    }

    const existingUids = await getExistingUids();
    if (existingUids.has(uid) && !force) {
      await finishEvaluationRun(runId, 0, 0, 0);
      return NextResponse.json(
        {
          success: false,
          error: `UID ${uid} already evaluated. Pass force: true to re-evaluate (this will overwrite the existing result).`,
          alreadyEvaluated: true,
          runId,
        },
        { status: 409 }
      );
    }

    const result = await evaluateSubmission(row, force, onStep);
    await finishEvaluationRun(runId, result.status === 'done' ? 1 : 0, result.status === 'error' ? 1 : 0, result.costUsd);
    await updateRunSteps(runId, steps).catch(() => {});

    return NextResponse.json({ success: true, result, runId, steps });
  } catch (err: any) {
    await finishEvaluationRun(runId, 0, 1, 0);
    await updateRunSteps(runId, steps).catch(() => {});
    return NextResponse.json({ success: false, error: err.message || String(err), runId, steps }, { status: 500 });
  }
}
