'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Video } from '@/lib/api';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Alert, Panel, StatusBadge, formatDuration } from '@/components/ui';
import { isWatchable } from '@/components/VideoCard';
import { RENDITION_ORDER } from '@/lib/renditions';

const ACTIVE: Video['status'][] = ['PENDING', 'PROCESSING'];

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getVideo(params.id)
      .then(setVideo)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load video'));
  }, [params.id]);

  useEffect(load, [load]);

  // Keep refreshing while the ladder fills in, so new renditions appear.
  useEffect(() => {
    if (!video || !ACTIVE.includes(video.status)) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [video, load]);

  const onProgress = useCallback(
    (position: number, duration: number) => {
      // Best effort: a lost progress ping must never interrupt playback.
      void api.saveProgress(params.id, position, duration).catch(() => undefined);
    },
    [params.id],
  );

  if (error) {
    return (
      <>
        <Alert tone="error" title="Not available">
          {error}
        </Alert>
        <Link href="/library" className="text-sm text-accent-soft hover:underline">
          Back to library
        </Link>
      </>
    );
  }

  if (!video) return <p className="text-ink-muted">Loading…</p>;

  const have = new Set(video.resolutions.map((r) => r.resolution));
  const lowest = video.resolutions[0]?.resolution;
  const inFlight = ACTIVE.includes(video.status);

  return (
    <>
      <Link href="/library" className="inline-flex items-center gap-1.5 self-start text-sm text-accent-soft hover:underline">
        <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Library
      </Link>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[320px] flex-[999_1_620px] flex-col gap-4">
          {inFlight && isWatchable(video) && (
            <Alert tone="success" title={`Playing at ${lowest}`}>
              Higher renditions are still encoding — quality will improve on its own, or pin a level in the player.
            </Alert>
          )}

          {video.playbackUrl ? (
            <VideoPlayer
              src={video.playbackUrl}
              poster={video.posterUrl}
              qualities={video.resolutions.map((r) => r.resolution)}
              onProgress={onProgress}
            />
          ) : (
            <Panel className="py-12 text-center text-ink-muted">
              This video is still being processed ({video.status.toLowerCase()}).
            </Panel>
          )}

          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{video.title}</h1>
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={video.status} watchable={isWatchable(video)} />
              <span className="font-mono text-[13px] text-ink-muted">
                {video.duration !== null && `${formatDuration(video.duration)} · `}
                {new Date(video.createdAt).toLocaleDateString()}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-[13px] ${video.isPublic ? 'text-ink-muted' : 'text-status-processing'}`}>
                {video.isPublic ? 'Public' : 'Private'}
              </span>
            </div>
            {video.description && (
              <p className="max-w-[680px] text-[15px] leading-relaxed text-ink-soft">{video.description}</p>
            )}
          </div>
        </div>

        <aside className="flex min-w-[260px] flex-[1_1_300px] flex-col gap-4">
          <Panel className="flex flex-col gap-3.5">
            <span className="text-sm font-semibold">Available now</span>
            <div className="flex flex-col gap-2">
              {RENDITION_ORDER.map((name) => {
                const rendition = video.resolutions.find((r) => r.resolution === name);
                const pending = !have.has(name) && inFlight;
                if (!rendition && !pending) return null;

                return (
                  <div key={name} className={`flex items-center justify-between text-[13px] ${rendition ? '' : 'text-ink-muted'}`}>
                    <span className="flex items-center gap-2">
                      {rendition ? (
                        <svg viewBox="0 0 24 24" className="h-3 w-3 text-status-ready" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <span className="w-3" />
                      )}
                      {name}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      {rendition
                        ? rendition.bitrate >= 1_000_000
                          ? `${(rendition.bitrate / 1_000_000).toFixed(1)} Mbps`
                          : `${Math.round(rendition.bitrate / 1000)} kbps`
                        : 'queued'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel className="flex flex-col gap-3">
            <span className="text-sm font-semibold">Keyboard</span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 text-[13px]">
              {(
                [
                  ['Space', 'Play or pause'],
                  ['← →', 'Seek 5 seconds'],
                  ['F', 'Full screen'],
                  ['M', 'Mute'],
                ] as const
              ).map(([key, meaning]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-ink-soft">{key}</dt>
                  <dd className="m-0 text-ink-muted">{meaning}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </aside>
      </div>
    </>
  );
}
