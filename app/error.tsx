'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      <div>
        <h1 className="text-lg font-semibold text-foreground">Something broke on this page</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred.'}
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
