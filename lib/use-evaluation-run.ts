'use client';

import { useCallback, useRef, useState } from 'react';
import type { StepEvent } from './pipeline-steps';

export interface RunProgress {
  running: boolean;
  done: number;
  total: number;
  errored: number;
  runId?: number;
  currentUid?: string;
  ok?: boolean;
  summary?: string;
}

const IDLE: RunProgress = { running: false, done: 0, total: 0, errored: 0 };

export type RunKind =
  | { kind: 'all' }
  | { kind: 'count'; count: number }
  | { kind: 'uid'; uid: string; force: boolean };

const ENDPOINT: Record<RunKind['kind'], string> = {
  all: '/api/evaluate/all',
  count: '/api/evaluate/count',
  uid: '/api/evaluate/uid',
};

/**
 * Drives an evaluation run and exposes its live state: overall progress plus
 * the flat pipeline step-event log. Streaming endpoints (all/count) feed events
 * as they arrive; the uid endpoint returns them in one JSON payload.
 */
export function useEvaluationRun() {
  const [progress, setProgress] = useState<RunProgress>(IDLE);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const erroredRef = useRef(0);

  const start = useCallback(async (req: RunKind) => {
    setProgress({ ...IDLE, running: true });
    setSteps([]);
    erroredRef.current = 0;

    try {
      if (req.kind === 'uid') {
        const res = await fetch(ENDPOINT.uid, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: req.uid, force: req.force }),
        });
        const body = await res.json().catch(() => ({}));
        if (Array.isArray(body.steps)) setSteps(body.steps);
        if (!res.ok) throw new Error(body.error || 'Evaluation failed');
        setProgress({
          running: false,
          done: 1,
          total: 1,
          errored: body?.result?.status === 'error' ? 1 : 0,
          runId: body.runId,
          ok: true,
          summary: `${body?.result?.status ?? 'done'} · $${Number(body?.result?.costUsd ?? 0).toFixed(5)}`,
        });
        return body.runId as number | undefined;
      }

      const res = await fetch(ENDPOINT[req.kind], {
        method: 'POST',
        headers: req.kind === 'count' ? { 'Content-Type': 'application/json' } : undefined,
        body: req.kind === 'count' ? JSON.stringify({ count: req.count }) : undefined,
      });
      if (!res.body) throw new Error('No response stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let runId: number | undefined;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'meta' || ev.type === 'start') {
            runId = ev.runId ?? runId;
            if (ev.type === 'start') {
              setProgress((p) => ({ ...p, running: true, total: ev.total, done: 0, runId }));
            }
          } else if (ev.type === 'step') {
            setSteps((s) => [...s, ev as StepEvent]);
            setProgress((p) => ({ ...p, currentUid: ev.uid }));
          } else if (ev.type === 'progress') {
            if (ev.status === 'error') erroredRef.current++;
            setProgress((p) => ({
              ...p,
              done: ev.done,
              total: ev.total,
              errored: erroredRef.current,
              currentUid: ev.uid,
            }));
          } else if (ev.type === 'done') {
            setProgress({
              running: false,
              done: ev.processed + ev.errored,
              total: ev.total ?? ev.processed + ev.errored,
              errored: ev.errored,
              runId: ev.runId ?? runId,
              ok: true,
              summary: `${ev.processed} processed · ${ev.errored} errored · $${Number(
                ev.totalCostUsd
              ).toFixed(4)}`,
            });
          } else if (ev.type === 'error') {
            setProgress({
              running: false,
              done: 0,
              total: 0,
              errored: 0,
              runId: ev.runId ?? runId,
              ok: false,
              summary: ev.error,
            });
          }
        }
      }
      return runId;
    } catch (e) {
      setProgress({
        running: false,
        done: 0,
        total: 0,
        errored: 0,
        ok: false,
        summary: (e as Error).message,
      });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(IDLE);
    setSteps([]);
  }, []);

  return { progress, steps, start, reset };
}
