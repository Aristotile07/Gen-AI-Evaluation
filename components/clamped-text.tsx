'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Renders possibly-long LLM prose with preserved line breaks and a show-more toggle. */
export function ClampedText({
  text,
  className,
  clampLines = 4,
}: {
  text: string | null | undefined;
  className?: string;
  clampLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const value = (text ?? '').trim();

  if (!value) return <span className="text-sm text-muted-foreground">—</span>;

  const isLong = value.length > 280 || value.split('\n').length > clampLines;

  return (
    <div className={cn('text-sm leading-relaxed text-foreground/90', className)}>
      <p className={cn('whitespace-pre-wrap', !expanded && isLong && 'line-clamp-4')}>{value}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
