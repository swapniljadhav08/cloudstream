'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Alert, Button, Field, inputClass } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-wrap">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col justify-between gap-10 border-surface-border bg-surface p-10 md:border-r">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="h-[26px] w-[26px] text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M16 10l5-3v10l-5-3z" />
          </svg>
          <span className="text-lg font-semibold">CloudStream</span>
        </div>

        <div className="flex max-w-[420px] flex-col gap-5">
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">
            Upload once.
            <br />
            Stream at every size.
          </h1>
          <p className="text-base leading-relaxed text-ink-muted">
            Drop in a file and it comes back as an adaptive ladder, from 144p upwards, ready to play or embed anywhere.
          </p>
          <ul className="flex list-none flex-col gap-3.5 p-0">
            {[
              'Watchable in seconds — the smallest rendition lands first',
              'One embed snippet, any site',
              'Private by default, with expiring playback links',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-status-ready" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span className="text-[15px] leading-relaxed text-ink-soft">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <span className="text-[13px] text-ink-muted">[YOUR COMPANY]</span>
      </div>

      <div className="flex min-w-0 flex-[999_1_520px] items-center justify-center p-10">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[26px] font-semibold tracking-tight">Sign in</h2>
            <p className="text-[15px] text-ink-muted">Welcome back.</p>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </Field>

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-muted">
            New here?{' '}
            <Link href="/auth/register" className="font-medium text-accent-soft hover:underline">
              Create an account
            </Link>
          </p>

          <p className="rounded-card border border-surface-border bg-surface p-4 text-[13px] leading-relaxed text-ink-muted">
            Access tokens last 15 minutes and refresh silently, so a long editing session is never interrupted by a
            surprise logout.
          </p>
        </div>
      </div>
    </div>
  );
}
