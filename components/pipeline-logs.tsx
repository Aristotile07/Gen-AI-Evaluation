'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { STEP_LABEL } from '@/lib/pipeline-steps';
import type { StepEvent, StepStatus } from '@/lib/pipeline-steps';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/copy-button';
import { cn } from '@/lib/utils';

const LEVEL_CLASS: Record<StepStatus, string> = {
  start: 'text-muted-foreground',
  ok: 'text-ok',
  skip: 'text-muted-foreground/70',
  error: 'text-danger',
};

const LEVELS: { key: 'all' | StepStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ok', label: 'OK' },
  { key: 'skip', label: 'Skipped' },
  { key: 'error', label: 'Errors' },
];

function line(e: StepEvent): string {
  const t = (() => {
    try {
      return format(new Date(e.at), 'HH:mm:ss');
    } catch {
      return '--:--:--';
    }
  })();
  const uid = e.uid ? e.uid.slice(0, 6) : '------';
  const label = STEP_LABEL[e.step] ?? e.step;
  const status = e.status.toUpperCase().padEnd(5);
  const detail = e.detail ? `  ${e.detail}` : '';
  const ms = e.ms != null ? `  (${e.ms}ms)` : '';
  return `${t}  [${uid}]  ${label.padEnd(24)} ${status}${detail}${ms}`;
}

export function PipelineLogs({ steps, live }: { steps: StepEvent[]; live?: boolean }) {
  const [level, setLevel] = useState<'all' | StepStatus>('all');
  const [autoscroll, setAutoscroll] = useState(true);
  const boxRef = useRef<HTMLPreElement>(null);

  const filtered = useMemo(
    () => (level === 'all' ? steps : steps.filter((s) => s.status === level)),
    [steps, level]
  );

  useEffect(() => {
    if (autoscroll && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [filtered.length, autoscroll]);

  const plain = filtered.map(line).join('\n');
  const errorCount = steps.filter((s) => s.status === 'error').length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {LEVELS.map((l) => (
            <Button
              key={l.key}
              size="sm"
              variant={level === l.key ? 'default' : 'outline'}
              onClick={() => setLevel(l.key)}
            >
              {l.label}
              {l.key === 'error' && errorCount > 0 && (
                <span className="ml-1 rounded-full bg-danger px-1.5 text-[10px] text-danger-foreground">
                  {errorCount}
                </span>
              )}
            </Button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={autoscroll}
            onChange={(e) => setAutoscroll(e.target.checked)}
          />
          Autoscroll
        </label>
        <CopyButton value={plain} label="Copy log" />
      </div>

      <pre
        ref={boxRef}
        className={cn(
          'h-80 overflow-auto rounded-lg border border-border bg-[hsl(227_24%_8%)] p-3 font-mono text-[11px] leading-relaxed text-[hsl(40_18%_88%)]',
          'dark:bg-[hsl(227_24%_6%)]'
        )}
      >
        {filtered.length === 0 ? (
          <span className="text-muted-foreground">
            {live ? 'Waiting for pipeline events…' : 'No events at this level.'}
          </span>
        ) : (
          filtered.map((e, i) => (
            <div key={i} className={LEVEL_CLASS[e.status]}>
              {line(e)}
            </div>
          ))
        )}
      </pre>
    </div>
  );
}
