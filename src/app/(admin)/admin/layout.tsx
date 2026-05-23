'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Users,
  Contact,
  Settings,
  Shield,
  Loader2,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/contacts', label: 'Contacts', icon: Contact },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAdmin() {
      try {
        const res = await fetch('/api/admin/check');
        const data = await res.json();

        if (!res.ok || !data.isAdmin) {
          if (data.reason === 'not_authenticated') {
            if (!cancelled) router.push('/login');
          } else {
            if (!cancelled) router.push('/dashboard');
          }
          return;
        }

        if (!cancelled) {
          setAuthorized(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('[AdminLayout] checkAdmin error:', err);
        if (!cancelled) router.push('/login');
      }
    }

    checkAdmin();
    return () => { cancelled = true; };
  }, [router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false);
  }, [pathname]);

  if (loading || !authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-indigo-600" />
          <p className="text-sm text-gray-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[240px] flex flex-col bg-white border-r border-gray-200 shadow-sm transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600">
              <Shield className="size-4 text-foreground" />
            </div>
            <span className="text-sm font-bold text-gray-900">Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <Icon className={cn('size-[18px]', isActive ? 'text-indigo-600' : 'text-gray-400')} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-gray-100">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="size-[18px] text-gray-400" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-indigo-600" />
            <span className="text-sm font-bold text-gray-900">Admin</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
