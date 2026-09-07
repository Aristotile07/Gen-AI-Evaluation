'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  return (
    <aside className="w-56 border-r border-gray-200 bg-white px-4 py-6 shrink-0">
      <div className="px-2 mb-8">
        <div className="text-sm font-semibold tracking-tight text-ink">Eval Dashboard</div>
        <div className="text-xs text-gray-400">AI Reliance Review</div>
      </div>
      <nav className="space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                active ? 'bg-ink text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
