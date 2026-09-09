import { cn } from '@/lib/utils';

type Tone = 'default' | 'danger' | 'warn' | 'ok';

const toneRing: Record<Tone, string> = {
  default: 'border-border',
  danger: 'border-danger/40 bg-danger-muted',
  warn: 'border-warn/40 bg-warn-muted',
  ok: 'border-ok/40 bg-ok-muted',
};

const toneValue: Record<Tone, string> = {
  default: 'text-foreground',
  danger: 'text-danger',
  warn: 'text-warn',
  ok: 'text-ok',
};

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border bg-card p-5', toneRing[tone])}>
      <div className="flex items-start justify-between">
        <div className={cn('text-2xl font-semibold tabular-nums', toneValue[tone])}>{value}</div>
        {icon && (
          <span className="text-muted-foreground" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground/80">{hint}</div>}
    </div>
  );
}
