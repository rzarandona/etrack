'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ConfirmProvider } from '@/lib/components/confirm';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/types';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type NavGroup = { heading: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    heading: 'Main',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1.5"/>
            <rect width="7" height="5" x="14" y="3" rx="1.5"/>
            <rect width="7" height="9" x="14" y="12" rx="1.5"/>
            <rect width="7" height="5" x="3" y="16" rx="1.5"/>
          </svg>
        ),
      },
      {
        href: '/events',
        label: 'Events',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
        ),
      },
      {
        href: '/scans',
        label: 'Scans',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        ),
      },
    ],
  },
  {
    heading: 'Workforce',
    items: [
      {
        href: '/employees',
        label: 'Employees',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        href: '/rates',
        label: 'Rates',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        ),
      },
      {
        href: '/badges',
        label: 'Badges',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="20" x="5" y="2" rx="2"/>
            <circle cx="12" cy="14" r="3"/>
            <path d="M9 6h6"/>
          </svg>
        ),
      },
    ],
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || '?';
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminShell({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  // Close profile dropdown on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const onSignOut = async () => {
    await getSupabaseBrowser().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen p-4 lg:p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full">
        {/* TOP BAR */}
        <header className="card flex items-center justify-between px-5 py-3 mb-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <span className="font-extrabold text-xl tracking-tight">etrack</span>
          </Link>

          <div className="flex-1 max-w-md mx-8 hidden md:block">
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                placeholder="Search employees, events, scans…"
                className="w-full pl-11 pr-4 py-2.5 rounded-full text-sm focus:outline-none"
                style={{ background: '#F5F2ED', color: 'var(--ink)' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div ref={profileRef} className="relative flex items-center gap-2 pl-3 border-l border-stone-200">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2"
                aria-haspopup="menu"
                aria-expanded={menuOpen}>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg,#F25C2D,#F2924A)' }}>
                  {initials(profile.full_name)}
                </div>
                <div className="hidden md:block leading-tight text-left">
                  <div className="text-sm font-bold">{profile.full_name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {profile.role === 'admin' ? 'Admin' : 'Supervisor'}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-48 card overflow-hidden ring-soft z-20">
                  <button
                    onClick={onSignOut}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-stone-50"
                    style={{ color: 'var(--accent-deep)' }}
                    role="menuitem">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex gap-5">
          {/* SIDEBAR */}
          <aside className="card w-60 shrink-0 p-3 hidden lg:block self-start sticky top-6">
            {NAV.map((group) => (
              <div key={group.heading}>
                <div className="px-3 pt-2 pb-1">
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {group.heading}
                  </div>
                </div>
                <nav className="flex flex-col gap-1 mt-1 mb-3">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`menu-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                          active ? 'menu-active font-semibold' : 'text-stone-700'
                        }`}>
                        {item.icon}
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}

            <div className="px-3 pt-2 pb-1">
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                General
              </div>
            </div>
            <nav className="flex flex-col gap-1 mt-1">
              <button
                onClick={onSignOut}
                className="menu-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: 'var(--accent)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                Sign out
              </button>
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            <ConfirmProvider>{children}</ConfirmProvider>
          </main>
        </div>
      </div>
    </div>
  );
}
