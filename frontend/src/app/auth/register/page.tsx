'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Alert, Button, Field, inputClass } from '@/components/ui';

// docs/17_Security.md: 8+ characters with upper, lower, digit and symbol.
const RULES = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'A lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'An uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'A digit', test: (v: string) => /[0-9]/.test(v) },
  { label: 'A symbol', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allMet = RULES.every((rule) => rule.test(form.password));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.register(form.email, form.password, form.name);
      // Registration returns no tokens, so sign in to start a session.
      await api.login(form.email, form.password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-10">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="h-[26px] w-[26px] text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M16 10l5-3v10l-5-3z" />
          </svg>
          <span className="text-lg font-semibold">CloudStream</span>
        </div>

        <h1 className="text-[26px] font-semibold tracking-tight">Create an account</h1>

        {error && <Alert tone="error">{error}</Alert>}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="name">
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className={inputClass}
            />
          </Field>

          {/* Rules tick as they are met, rather than failing after submit. */}
          <ul className="flex list-none flex-col gap-1.5 p-0">
            {RULES.map((rule) => {
              const met = rule.test(form.password);
              return (
                <li key={rule.label} className={`flex items-center gap-2 text-[13px] ${met ? 'text-status-ready' : 'text-ink-muted'}`}>
                  {met ? (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-current opacity-50" />
                  )}
                  {rule.label}
                </li>
              );
            })}
          </ul>

          <Button type="submit" disabled={busy || !allMet} className="w-full">
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-muted">
          Already registered?{' '}
          <Link href="/auth/login" className="font-medium text-accent-soft hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
