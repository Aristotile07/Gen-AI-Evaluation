import { ExternalLink as ExternalLinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ExternalLink({
  href,
  children,
  className,
  showIcon = true,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <span className="truncate">{children}</span>
      {showIcon && <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />}
    </a>
  );
}
