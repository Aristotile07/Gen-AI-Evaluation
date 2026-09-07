'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Overview', icon: '\u25A6' },
  { href: '/submissions', label: 'Submissions', icon: '\u2261' },
  { href: '/manual-review', label: 'Manual Review', icon: '\u26A0' },
  { href: '/duplicates', label: 'Duplicates', icon: '\u2942' },
  { href: '/costs', label: 'API Cost', icon: '$' },
  { href: '/evaluate', label: 'Evaluate', icon: '\u25B6' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-60 border-r border-gray-200 bg-white px-4 py-6 shrink-0 flex flex-col">
      <div className="px-2 mb-8 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-ink text-white flex items-center justify-center text-sm font-semibold shrink-0">
          E
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-ink leading-tight">Eval Dashboard</div>
          <div className="text-[11px] text-gray-400 leading-tight">AI Reliance Review</div>
        </div>
      </div>

      <nav className="space-y-0.5 flex-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? 'bg-ink text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="w-4 text-center text-[13px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors mt-4 border-t border-gray-100 pt-4"
      >
        <span className="w-4 text-center text-[13px]">&#8594;</span>
        Sign out
      </button>
    </aside>
  );
}
