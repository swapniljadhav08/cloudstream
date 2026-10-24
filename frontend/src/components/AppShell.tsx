'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api, tokens, type Me } from '@/lib/api';
import { QuotaMeter } from '@/components/ui';

// Routes that render without the app chrome: the auth pages, and the embed
// player, which is dropped into other people's sites in an iframe.
function isBare(pathname: string): boolean {
  return pathname.startsWith('/auth') || pathname.startsWith('/embed');
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/library', label: 'Library', icon: 'library' },
  { href: '/upload', label: 'Upload', icon: 'upload' },
  { href: '/settings', label: 'Account', icon: 'gear' },
] as const;

function Icon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'h-[17px] w-[17px] shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case 'library':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M10 9l5 2-5 2z" />
        </svg>
      );
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M4 18h16" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 4.5-3.2 8.4-8 9-4.8-.6-8-4.5-8-9V6z" />
        </svg>
      );
    default:
      return null;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const bare = isBare(pathname);

  useEffect(() => {
    if (bare) return;
    if (!tokens.access) {
      router.push('/auth/login');
      return;
    }
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null));
  }, [bare, pathname, router]);

  if (bare) return <>{children}</>;

  const isAdmin = me !== null && me.role !== 'USER';

  async function onLogout() {
    await api.logout();
    setMe(null);
    router.push('/auth/login');
  }

  return (
    <div className="flex min-h-screen flex-wrap">
      {/* Never sticky and never 100vh: it has to stack on a phone. */}
      <nav
        aria-label="Main"
        className="flex min-w-0 flex-[1_1_232px] flex-col gap-6 border-b border-surface-border bg-surface p-4 md:border-b-0 md:border-r"
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-1">
          <svg viewBox="0 0 24 24" className="h-[23px] w-[23px] text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M16 10l5-3v10l-5-3z" />
          </svg>
          <span className="text-base font-semibold">CloudStream</span>
        </Link>

        <div className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-control px-3 text-sm ${
                  active
                    ? 'bg-accent/15 font-semibold text-accent-soft'
                    : 'text-ink-soft hover:bg-surface-inset'
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-control px-3 text-sm ${
                pathname.startsWith('/admin')
                  ? 'bg-accent/15 font-semibold text-accent-soft'
                  : 'text-ink-soft hover:bg-surface-inset'
              }`}
            >
              <Icon name="shield" />
              Operations
            </Link>
          )}
        </div>

        {me && (
          <div className="mt-auto flex flex-col gap-4">
            <div className="rounded-control border border-surface-border bg-surface-inset p-3.5">
              <QuotaMeter used={me.storageUsed} quota={me.storageQuota} compact />
            </div>

            <div className="flex items-center gap-2.5 px-1">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-ground">
                {me.name
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium">{me.name}</span>
                <span className="text-xs capitalize text-ink-muted">
                  {me.role.toLowerCase().replace('_', ' ')}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void onLogout()}
                aria-label="Log out"
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-surface-inset hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 17l5-5-5-5" />
                  <path d="M20 12H9" />
                  <path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-7 p-6 md:p-10">{children}</main>
    </div>
  );
}
