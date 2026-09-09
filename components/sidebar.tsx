'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ListChecks,
  AlertTriangle,
  CopyCheck,
  DollarSign,
  Play,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/submissions', label: 'Submissions', icon: ListChecks },
  { href: '/manual-review', label: 'Manual Review', icon: AlertTriangle },
  { href: '/duplicates', label: 'Duplicates', icon: CopyCheck },
  { href: '/costs', label: 'API Cost', icon: DollarSign },
  { href: '/evaluate', label: 'Evaluate', icon: Play },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Could not sign out. Try again.');
    }
  }

  return (
    <div className="flex h-full flex-col bg-card px-3 py-5">
      <div className="mb-6 flex items-center justify-between px-2">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            P
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-foreground">
              Project Evaluator
            </div>
            <div className="text-[11px] text-muted-foreground">AI reliance review</div>
          </div>
        </Link>
        <div className="lg:hidden">
          <ThemeToggle />
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
