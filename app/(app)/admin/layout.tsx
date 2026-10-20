import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const tabs = [
    { href: '/admin/members', label: 'Members' },
    { href: '/admin/requests', label: 'Coin requests' },
    { href: '/admin/catalogue', label: 'Prices' },
  ];
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1 text-sm font-medium">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-md bg-white px-3 py-1.5 text-navy-700 shadow-card hover:text-orange-600">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
