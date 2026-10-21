'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDetails([]);

    try {
      await api.register(form.email, form.password, form.name);
      // Registration does not return tokens, so log in to get a session.
      await api.login(form.email, form.password);
      router.push('/library');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (Array.isArray(err.details)) {
          setDetails(
            (err.details as { path: string; message: string }[]).map(
              (d) => `${d.path}: ${d.message}`,
            ),
          );
        }
      } else {
        setError('Registration failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Create an account</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        {(['name', 'email', 'password'] as const).map((field) => (
          <label key={field} className="block">
            <span className="mb-1 block text-sm capitalize text-slate-300">{field}</span>
            <input
              type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
              required
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="w-full rounded border border-surface-border bg-surface-raised px-3 py-2"
            />
          </label>
        ))}

        <p className="text-xs text-slate-500">
          At least 8 characters, with upper and lower case, a digit and a symbol.
        </p>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {details.length > 0 && (
          <ul className="list-inside list-disc text-xs text-red-400">
            {details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-sky-600 px-4 py-2 font-medium hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? 'Creating...' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-400">
        Already registered?{' '}
        <Link href="/auth/login" className="text-sky-400 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
