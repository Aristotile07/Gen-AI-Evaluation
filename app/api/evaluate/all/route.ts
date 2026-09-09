import { readResponseSheet } from '@/lib/sheets';
import { getExistingUids, startEvaluationRun, finishEvaluationRun } from '@/lib/db';
import { evaluateSubmission } from '@/lib/pipeline';

export const maxDuration = 300; // batch runs can take a while

// Streams newline-delimited JSON progress events so the client can show
// "Processing X of N" instead of a frozen button.
export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      const runId = await startEvaluationRun('all_new');
      let processed = 0;
      let errored = 0;
      let totalCost = 0;

      try {
        const allRows = await readResponseSheet();
        const existingUids = await getExistingUids();
        const newRows = allRows.filter((r) => r.uid && !existingUids.has(r.uid));

        send({ type: 'start', total: newRows.length });

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
          totalNewRows: newRows.length,
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
