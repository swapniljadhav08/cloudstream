'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, tokens, type Me } from '@/lib/api';

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const isEmbed = pathname?.startsWith('/embed') ?? false;

  useEffect(() => {
    if (isEmbed || !tokens.access) return;
    api.me().then(setMe).catch(() => setMe(null));
  }, [isEmbed]);

  async function onLogout() {
    await api.logout();
    setMe(null);
    router.push('/auth/login');
  }

  if (isEmbed) return null;

  return (
    <header className="border-b border-surface-border bg-surface-raised">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-4">
        <Link href="/library" className="font-semibold tracking-tight">
          Video Platform
        </Link>
        <Link href="/library" className="text-sm text-slate-300 hover:text-white">
          Library
        </Link>
        {me?.role !== 'USER' && me && (
          <Link href="/admin" className="text-sm text-slate-300 hover:text-white">
            Admin
          </Link>
        )}

        <div className="ml-auto flex items-center gap-4 text-sm">
          {me ? (
            <>
              <span className="text-slate-400">
                {me.name} &middot; {formatBytes(me.storageUsed)} / {formatBytes(me.storageQuota)}
              </span>
              <button
                onClick={onLogout}
                className="rounded border border-surface-border px-3 py-1 text-slate-200 hover:bg-surface"
              >
                Log out
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="text-slate-300 hover:text-white">
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
