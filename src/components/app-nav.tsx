'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthButtons } from '@/components/auth-buttons';

const links = [
  { href: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/clients', label: 'العملاء', icon: Users },
  { href: '/import', label: 'استيراد البيانات', icon: Upload },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-background px-4 py-2 flex gap-2 flex-wrap items-center justify-between" dir="rtl">
      <div className="flex gap-2 flex-wrap items-center">
      {links.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
      </div>
      <AuthButtons />
    </nav>
  );
}
