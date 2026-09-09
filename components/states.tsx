import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function EmptyState({
  title = 'Nothing here yet',
  message,
  icon,
  className,
}: {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-6 py-14 text-center',
        className
      )}
    >
      <div className="text-muted-foreground" aria-hidden>
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {message && <p className="max-w-sm text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

export function ErrorState({
  message = 'Something went wrong loading this data.',
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-danger-muted px-6 py-12 text-center',
        className
      )}
    >
      <AlertTriangle className="h-6 w-6 text-danger" aria-hidden />
      <p className="max-w-md text-sm text-danger">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-3 py-2.5">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-3 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-20' : 'flex-1 max-w-[160px]')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
