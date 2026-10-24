'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type Me, type Video } from '@/lib/api';
import { isWatchable } from '@/components/VideoCard';
import {
  Alert,
  Button,
  ButtonLink,
  PageHeader,
  Panel,
  ProgressBar,
  StatusBadge,
  formatBytes,
  formatDuration,
} from '@/components/ui';

const ACTIVE: Video['status'][] = ['PENDING', 'PROCESSING'];

export default function DashboardPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [list, profile] = await Promise.all([api.listVideos({ limit: 50 }), api.me()]);
    setVideos(list.videos);
    setMe(profile);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, [reload]);

  // Poll only while something is in flight, and stop when the queue drains.
  useEffect(() => {
    const pending = videos.filter((v) => ACTIVE.includes(v.status));
    if (pending.length === 0) return;

    const timer = setInterval(() => {
      void (async () => {
        const results = await Promise.all(pending.map((v) => api.getStatus(v.id).catch(() => null)));
        setProgress((prev) => {
          const next = { ...prev };
          for (const r of results) if (r) next[r.videoId] = r.progress;
          return next;
        });
        if (results.some((r) => r && !ACTIVE.includes(r.status))) await reload();
      })();
    }, 2500);

    return () => clearInterval(timer);
  }, [videos, reload]);

  const byStatus = (status: Video['status']) => videos.filter((v) => v.status === status).length;
  const encoding = videos.filter((v) => ACTIVE.includes(v.status));
  const failed = videos.filter((v) => v.status === 'FAILED');
  const recent = videos.slice(0, 4);

  return (
    <>
      <PageHeader
        title={me ? `Hello, ${me.name.split(' ')[0]}` : 'Dashboard'}
        subtitle={
          loading
            ? 'Loading your library…'
            : encoding.length > 0 || failed.length > 0
              ? [
                  encoding.length > 0 && `${encoding.length} encoding`,
                  failed.length > 0 && `${failed.length} needs attention`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Everything is encoded and ready.'
        }
        action={<ButtonLink href="/upload">Upload video</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-muted">Videos</span>
          <span className="text-3xl font-semibold tabular-nums tracking-tight">{videos.length}</span>
          <span className="text-[13px] text-ink-muted">
            {byStatus('COMPLETED')} ready · {encoding.length} encoding
          </span>
        </Panel>

        <Panel className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-muted">Storage used</span>
          <span className="text-3xl font-semibold tabular-nums tracking-tight">
            {me ? formatBytes(me.storageUsed) : '—'}
          </span>
          <span className="text-[13px] text-ink-muted">
            {me && me.storageQuota > 0
              ? `${Math.round((me.storageUsed / me.storageQuota) * 100)}% of ${formatBytes(me.storageQuota)}`
              : ''}
          </span>
        </Panel>

        <Panel className="flex flex-col gap-2">
          <span className="text-[13px] text-status-processing">In the queue</span>
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-status-processing">
            {encoding.length}
          </span>
          <span className="text-[13px] text-ink-muted">
            {encoding.length > 0 ? `${progress[encoding[0].id] ?? 0}% on the current job` : 'Nothing waiting'}
          </span>
        </Panel>

        <Panel
          className={
            failed.length > 0 ? 'flex flex-col gap-2 border-status-failed/40 bg-status-failed/[0.08]' : 'flex flex-col gap-2'
          }
        >
          <span className={`text-[13px] ${failed.length > 0 ? 'text-status-failed' : 'text-ink-muted'}`}>
            Needs attention
          </span>
          <span
            className={`text-3xl font-semibold tabular-nums tracking-tight ${
              failed.length > 0 ? 'text-status-failed' : ''
            }`}
          >
            {failed.length}
          </span>
          {failed.length > 0 ? (
            <Link href={`/videos/${failed[0].id}`} className="text-[13px] font-medium text-accent-soft hover:underline">
              Review failure
            </Link>
          ) : (
            <span className="text-[13px] text-ink-muted">No failures</span>
          )}
        </Panel>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Recent uploads</h2>
          <Link href="/library" className="text-sm text-accent-soft hover:underline">
            View all {videos.length}
          </Link>
        </div>

        {loading ? (
          <Panel className="text-sm text-ink-muted">Loading…</Panel>
        ) : recent.length === 0 ? (
          <Panel className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm text-ink-muted">Nothing uploaded yet.</span>
            <ButtonLink href="/upload" variant="secondary">
              Upload your first video
            </ButtonLink>
          </Panel>
        ) : (
          <div className="overflow-hidden rounded-card border border-surface-border bg-surface">
            {recent.map((video, index) => (
              <div
                key={video.id}
                className={`flex flex-wrap items-center gap-4 p-4 ${
                  index < recent.length - 1 ? 'border-b border-surface-border' : ''
                }`}
              >
                <div className="h-[63px] w-[112px] shrink-0 overflow-hidden rounded-md bg-surface-inset">
                  {video.posterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.posterUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>

                <div className="flex min-w-[240px] flex-[999_1_240px] flex-col gap-2">
                  <Link href={`/videos/${video.id}`} className="text-[15px] font-semibold hover:text-accent-soft">
                    {video.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <StatusBadge status={video.status} watchable={isWatchable(video)} />
                    {ACTIVE.includes(video.status) ? (
                      <span className="text-[13px] text-status-processing">
                        still improving — {progress[video.id] ?? 0}%
                      </span>
                    ) : video.status === 'FAILED' ? (
                      <span className="text-[13px] text-ink-soft">Transcode failed — open it for the reason.</span>
                    ) : (
                      <span className="font-mono text-xs text-ink-muted">
                        {video.resolutions.length} renditions
                        {video.duration !== null && ` · ${formatDuration(video.duration)}`}
                        {` · ${video.isPublic ? 'public' : 'private'}`}
                      </span>
                    )}
                  </div>
                  {ACTIVE.includes(video.status) && (
                    <ProgressBar
                      percent={progress[video.id] ?? 0}
                      label={`Encoding progress for ${video.title}`}
                      className="max-w-[320px]"
                    />
                  )}
                </div>

                {video.playbackUrl ? (
                  <ButtonLink href={`/player/${video.id}`} variant="secondary" className="shrink-0">
                    Watch
                  </ButtonLink>
                ) : video.status === 'FAILED' ? (
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => void api.reprocess(video.id).then(() => reload())}
                  >
                    Reprocess
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {me && me.storageQuota > 0 && me.storageUsed / me.storageQuota >= 0.8 && (
        <Alert tone="warning" title="Storage is nearly full">
          You have used {formatBytes(me.storageUsed)} of {formatBytes(me.storageQuota)}. Uploads still work, but they
          will be refused once the quota is reached.{' '}
          <Link href="/settings" className="font-medium underline">
            Free up space
          </Link>
        </Alert>
      )}
    </>
  );
}
