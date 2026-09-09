'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock scroll when the drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className={cn('lg:hidden', drawerOpen ? 'fixed inset-0 z-50' : 'contents')}>
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <div className="fixed left-0 top-0 h-full w-64 border-r border-border shadow-xl">
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </div>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold">Project Evaluator</span>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
