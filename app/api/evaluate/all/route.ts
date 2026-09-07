import { NextResponse } from 'next/server';
import { readResponseSheet } from '@/lib/sheets';
import { getExistingUids, startEvaluationRun, finishEvaluationRun } from '@/lib/db';
import { evaluateSubmission } from '@/lib/pipeline';

export const maxDuration = 300; // Vercel function timeout, seconds — batch runs can take a while

export async function POST() {
  const runId = await startEvaluationRun('all_new');

  try {
    const allRows = await readResponseSheet();
    const existingUids = await getExistingUids();
    const newRows = allRows.filter((r) => r.uid && !existingUids.has(r.uid));

    let processed = 0;
    let errored = 0;
    let totalCost = 0;

    for (const row of newRows) {
      try {
        const result = await evaluateSubmission(row);
        totalCost += result.costUsd;
        if (result.status === 'error') errored++;
        else processed++;
      } catch (err) {
        errored++;
        console.error(`Failed to evaluate ${row.uid}:`, err);
      }
    }

    await finishEvaluationRun(runId, processed, errored, totalCost);

    return NextResponse.json({
      success: true,
      totalNewRows: newRows.length,
      processed,
      errored,
      totalCostUsd: totalCost,
    });
  } catch (err: any) {
    await finishEvaluationRun(runId, 0, 0, 0);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
