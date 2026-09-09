import { NextRequest } from 'next/server';
import { readResponseSheet } from '@/lib/sheets';
import { getExistingUids, startEvaluationRun, finishEvaluationRun } from '@/lib/db';
import { evaluateSubmission } from '@/lib/pipeline';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const count = parseInt(body.count, 10);
  const encoder = new TextEncoder();

  if (!count || count <= 0) {
    return new Response(JSON.stringify({ type: 'error', error: 'Invalid count' }) + '\n', {
      status: 400,
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      const runId = await startEvaluationRun('specific_count', count);
      let processed = 0;
      let errored = 0;
      let totalCost = 0;

      try {
        const allRows = await readResponseSheet();
        const existingUids = await getExistingUids();
        const newRows = allRows
          .filter((r) => r.uid && !existingUids.has(r.uid))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(0, count);

        send({ type: 'start', total: newRows.length, requestedCount: count });

        for (let i = 0; i < newRows.length; i++) {
          const row = newRows[i];
          let status: 'done' | 'error' = 'done';
          try {
            const result = await evaluateSubmission(row);
            totalCost += result.costUsd;
            if (result.status === 'error') {
              errored++;
              status = 'error';
            } else {
              processed++;
            }
          } catch (err) {
            errored++;
            status = 'error';
            console.error(`Failed to evaluate ${row.uid}:`, err);
          }
          send({ type: 'progress', done: i + 1, total: newRows.length, uid: row.uid, status });
        }

        await finishEvaluationRun(runId, processed, errored, totalCost);
        send({
          type: 'done',
          runId,
          requestedCount: count,
          actuallyProcessed: newRows.length,
          processed,
          errored,
          totalCostUsd: totalCost,
        });
      } catch (err: any) {
        await finishEvaluationRun(runId, processed, errored, totalCost);
        send({ type: 'error', error: err?.message || String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
    },
  });
}
