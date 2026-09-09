'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const userId = useId();
  const passId = useId();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Login failed.');
    } catch {
      setError('Network error — could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            P
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Project Evaluator</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI reliance review console</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <Label htmlFor={userId}>Username</Label>
            <Input
              id={userId}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={passId}>Password</Label>
            <Input
              id={passId}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger/20 bg-danger-muted px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
