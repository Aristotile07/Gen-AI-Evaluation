'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { RunKind } from '@/lib/use-evaluation-run';

export function RunControls({
  onRun,
  disabled,
}: {
  onRun: (req: RunKind) => void;
  disabled?: boolean;
}) {
  const [count, setCount] = useState('10');
  const [uid, setUid] = useState('');
  const [force, setForce] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Evaluate all new</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Every unprocessed row in the response sheet.</p>
          <Button onClick={() => onRun({ kind: 'all' })} disabled={disabled} aria-busy={disabled}>
            <Play className="h-4 w-4" />
            Run all
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evaluate a batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Next N unprocessed rows, oldest first.</p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-20"
              aria-label="Batch size"
            />
            <Button
              onClick={() => onRun({ kind: 'count', count: parseInt(count, 10) || 1 })}
              disabled={disabled}
              aria-busy={disabled}
            >
              Run {count || 'N'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evaluate one UID</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Force overwrites an existing result.</p>
          <div className="space-y-2">
            <Input
              placeholder="Paste UID…"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              aria-label="UID"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={force} onCheckedChange={(v) => setForce(!!v)} />
                Force
              </label>
              <Button
                onClick={() =>
                  force ? setConfirmForce(true) : onRun({ kind: 'uid', uid: uid.trim(), force: false })
                }
                disabled={disabled || !uid.trim()}
                aria-busy={disabled}
              >
                Run UID
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmForce}
        onOpenChange={setConfirmForce}
        title="Force re-evaluate this UID?"
        description="This overwrites the existing result and spends a fresh set of API calls."
        confirmLabel="Force re-evaluate"
        destructive
        onConfirm={() => onRun({ kind: 'uid', uid: uid.trim(), force: true })}
      />
    </div>
  );
}
