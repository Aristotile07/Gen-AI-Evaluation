import { NextRequest, NextResponse } from 'next/server';
import { readResponseSheet } from '@/lib/sheets';
import { getExistingUids, startEvaluationRun, finishEvaluationRun } from '@/lib/db';
import { evaluateSubmission } from '@/lib/pipeline';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const count = parseInt(body.count, 10);

  if (!count || count <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid count' }, { status: 400 });
  }

  const runId = await startEvaluationRun('specific_count', count);

  try {
    const allRows = await readResponseSheet();
    const existingUids = await getExistingUids();
    // Oldest-first, so testing in small batches processes submissions in the order they came in
    const newRows = allRows
      .filter((r) => r.uid && !existingUids.has(r.uid))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(0, count);

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
      requestedCount: count,
      actuallyProcessed: newRows.length,
      processed,
      errored,
      totalCostUsd: totalCost,
    });
  } catch (err: any) {
    await finishEvaluationRun(runId, 0, 0, 0);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
