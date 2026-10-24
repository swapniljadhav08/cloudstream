'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Alert, PageHeader, Panel, formatBytes } from '@/components/ui';

type Stats = Awaited<ReturnType<typeof api.adminStats>>;

const QUEUE_ORDER = ['waiting', 'active', 'completed', 'failed', 'delayed'] as const;

const QUEUE_TONE: Record<string, string> = {
  active: 'border-status-processing/36 bg-status-processing/10 text-status-processing',
  failed: 'border-status-failed/40 bg-status-failed/10 text-status-failed',
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    api
      .adminStats()
      .then((next) => {
        setStats(next);
        setUpdated(new Date());
        setError(null);
      })
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError && err.status === 403
            ? 'This page needs an administrator account.'
            : err instanceof ApiError
              ? err.message
              : 'Could not load statistics',
        ),
      );
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) {
    return (
      <>
        <PageHeader title="Operations" />
        <Alert tone="error" title="Not available">
          {error}
        </Alert>
      </>
    );
  }

  if (!stats) return <p className="text-ink-muted">Loading…</p>;

  const videoStates = Object.entries(stats.videos).filter(([, count]) => count > 0);
  const failedJobs = stats.jobs.failed ?? 0;

  return (
    <>
      <PageHeader
        title="Operations"
        subtitle={updated ? `Updated ${updated.toLocaleTimeString()} · refreshes every 5s` : undefined}
        action={
          <span
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-control border px-3.5 text-sm font-semibold ${
              failedJobs > 0
                ? 'border-status-failed/40 bg-status-failed/10 text-status-failed'
                : 'border-status-ready/40 bg-status-ready/10 text-status-ready'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${failedJobs > 0 ? 'bg-status-failed' : 'bg-status-ready'}`} />
            {failedJobs > 0 ? `${failedJobs} failed jobs` : 'Queue healthy'}
          </span>
        }
      />

      <section className="flex flex-col gap-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Accounts</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-muted">Users</span>
            <span className="text-2xl font-semibold tabular-nums">{stats.users.total}</span>
          </Panel>
          <Panel className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-muted">Active</span>
            <span className="text-2xl font-semibold tabular-nums text-status-ready">{stats.users.active}</span>
          </Panel>
          <Panel className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-muted">Storage in use</span>
            <span className="text-2xl font-semibold tabular-nums">{formatBytes(stats.storage.totalBytesUsed)}</span>
          </Panel>
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Transcode queue</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUEUE_ORDER.map((key) => (
            <div
              key={key}
              className={`flex flex-col gap-1 rounded-[9px] border p-3.5 ${
                QUEUE_TONE[key] ?? 'border-surface-border bg-surface-inset text-ink-muted'
              }`}
            >
              <span className="text-xs capitalize">{key}</span>
              <span className="text-xl font-semibold tabular-nums">{stats.jobs[key] ?? 0}</span>
            </div>
          ))}
        </div>
        {failedJobs > 0 && (
          <Alert tone="error" title={`${failedJobs} ${failedJobs === 1 ? 'job has' : 'jobs have'} failed`}>
            Open each video to see the worker&rsquo;s own message and retry it. A bulk retry view is not built yet.
          </Alert>
        )}
      </section>

      <section className="flex flex-col gap-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Videos by status</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {videoStates.length === 0 ? (
            <Panel className="text-[13px] text-ink-muted">No videos yet.</Panel>
          ) : (
            videoStates.map(([status, count]) => (
              <div key={status} className="flex flex-col gap-1 rounded-[9px] border border-surface-border bg-surface-inset p-3.5">
                <span className="text-xs capitalize text-ink-muted">{status.toLowerCase()}</span>
                <span className="text-xl font-semibold tabular-nums">{count}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <Panel className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Not built yet</span>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Per-user management, quota overrides and the audit-log viewer are designed but unimplemented. The API already
          serves <code className="font-mono">/admin/jobs</code> and <code className="font-mono">/admin/audit</code>, so
          these are UI work rather than backend work.
        </p>
      </Panel>
    </>
  );
}
