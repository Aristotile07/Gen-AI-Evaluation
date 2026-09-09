'use client';

import { ChevronRight, Check, X, Minus, Loader2 } from 'lucide-react';
import { PIPELINE_NODES, reduceStepStates } from '@/lib/pipeline-steps';
import type { StepEvent, StepId, StepStatus } from '@/lib/pipeline-steps';
import { cn } from '@/lib/utils';

type NodeState = { status: StepStatus | 'idle'; detail?: string; ms?: number };

const DOT: Record<NodeState['status'], string> = {
  idle: 'bg-muted-foreground/30',
  start: 'bg-accent',
  ok: 'bg-ok',
  skip: 'bg-muted-foreground/40',
  error: 'bg-danger',
};

function StatusIcon({ status }: { status: NodeState['status'] }) {
  if (status === 'start') return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />;
  if (status === 'ok') return <Check className="h-3.5 w-3.5 text-ok" />;
  if (status === 'error') return <X className="h-3.5 w-3.5 text-danger" />;
  if (status === 'skip') return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  return <span className={cn('h-2 w-2 rounded-full', DOT.idle)} />;
}

function Node({
  label,
  hint,
  state,
}: {
  label: string;
  hint: string;
  state: NodeState;
}) {
  return (
    <div
      className={cn(
        'w-44 shrink-0 rounded-lg border bg-card p-3 transition-colors',
        state.status === 'start' && 'border-accent ring-1 ring-accent/40',
        state.status === 'ok' && 'border-ok/40',
        state.status === 'error' && 'border-danger/50 bg-danger-muted',
        state.status === 'skip' && 'border-dashed opacity-60',
        state.status === 'idle' && 'border-border'
      )}
      title={hint}
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={state.status} />
        <span className="truncate text-xs font-medium text-foreground">{label}</span>
      </div>
      {state.detail && (
        <p
          className={cn(
            'mt-1.5 line-clamp-2 text-[11px]',
            state.status === 'error' ? 'text-danger' : 'text-muted-foreground'
          )}
        >
          {state.detail}
        </p>
      )}
      {state.ms != null && state.status !== 'error' && (
        <p className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">{state.ms} ms</p>
      )}
    </div>
  );
}

function Connector() {
  return <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />;
}

export function PipelineFlow({
  steps,
  currentUid,
}: {
  steps: StepEvent[];
  currentUid?: string;
}) {
  const states = reduceStepStates(steps, currentUid);
  const spine = PIPELINE_NODES.filter((n) => n.group === 'spine');
  const ai = PIPELINE_NODES.filter((n) => n.group === 'ai');

  // AI cluster sits between 'artifacts' and 'aggregate' in the spine order.
  const aiInsertAfter: StepId = 'artifacts';
  const rendered: React.ReactNode[] = [];

  spine.forEach((n, i) => {
    if (i > 0) rendered.push(<Connector key={`c-${n.id}`} />);
    rendered.push(<Node key={n.id} label={n.label} hint={n.hint} state={states[n.id]} />);
    if (n.id === aiInsertAfter) {
      rendered.push(<Connector key="c-ai" />);
      rendered.push(
        <div
          key="ai-cluster"
          className="flex shrink-0 flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-2"
        >
          <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            AI analysis
          </span>
          {ai.map((a) => (
            <Node key={a.id} label={a.label} hint={a.hint} state={states[a.id]} />
          ))}
        </div>
      );
    }
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card/50 p-4">
      <div className="flex min-w-max items-center gap-2">{rendered}</div>
      {currentUid && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          showing steps for {currentUid.slice(0, 12)}…
        </p>
      )}
    </div>
  );
}
