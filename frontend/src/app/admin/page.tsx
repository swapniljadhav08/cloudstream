'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Stats = Awaited<ReturnType<typeof api.adminStats>>;

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .adminStats()
        .then(setStats)
        .catch((err: unknown) =>
          setError(err instanceof ApiError ? err.message : 'Could not load stats'),
        );

    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!stats) return <p className="text-slate-400">Loading...</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">System overview</h1>

      <Section title="Users">
        <Tile label="Total" value={stats.users.total} />
        <Tile label="Active" value={stats.users.active} />
        <Tile label="Storage used" value={formatBytes(stats.storage.totalBytesUsed)} />
      </Section>

      <Section title="Videos by status">
        {Object.entries(stats.videos).map(([status, count]) => (
          <Tile key={status} label={status} value={count} />
        ))}
      </Section>

      <Section title="Transcode queue">
        {Object.entries(stats.jobs).map(([state, count]) => (
          <Tile key={state} label={state} value={count} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
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
