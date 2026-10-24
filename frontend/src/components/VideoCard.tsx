'use client';

import Link from 'next/link';
import { StatusBadge, formatDuration } from '@/components/ui';
import type { Video } from '@/lib/api';

/** A processing video is watchable as soon as one rendition exists. */
export function isWatchable(video: Video): boolean {
  return video.resolutions.length > 0;
}

export function VideoCard({
  video,
  progress,
  selected,
  onSelect,
}: {
  video: Video;
  progress?: number;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
}) {
  const watchable = isWatchable(video);
  const inFlight = video.status === 'PENDING' || video.status === 'PROCESSING';

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-card bg-surface ${
        selected
          ? 'border-2 border-accent'
          : video.status === 'FAILED'
            ? 'border border-status-failed/40'
            : 'border border-surface-border'
      }`}
    >
      <div className="relative aspect-video bg-surface-inset">
        {video.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-muted">
            {video.status === 'FAILED' ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-status-failed" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            )}
          </div>
        )}

        {onSelect && (
          <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-1.5 rounded-md bg-ground/85 px-2 py-1">
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={(event) => onSelect(event.target.checked)}
              className="h-[15px] w-[15px] cursor-pointer accent-accent"
            />
            <span className="sr-only">Select {video.title}</span>
          </label>
        )}

        {video.duration !== null && (
          <span className="absolute bottom-2 right-2 rounded bg-ground/90 px-1.5 py-0.5 font-mono text-xs">
            {formatDuration(video.duration)}
          </span>
        )}

        {inFlight && progress !== undefined && (
          <span className="absolute bottom-0 left-0 right-0 block h-1 bg-surface-inset">
            <span className="block h-full bg-status-processing transition-[width]" style={{ width: `${progress}%` }} />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3">
        <Link href={`/videos/${video.id}`} className="text-sm font-semibold leading-snug hover:text-accent-soft">
          {video.title}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={video.status} watchable={watchable} />
          <span className={`inline-flex items-center gap-1 text-xs ${video.isPublic ? 'text-ink-muted' : 'text-status-processing'}`}>
            {video.isPublic ? (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18" />
                <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            )}
            {video.isPublic ? 'Public' : 'Private'}
          </span>
        </div>

        {video.resolutions.length > 0 ? (
          <span className="truncate font-mono text-[11px] text-ink-muted">
            {video.resolutions.map((r) => r.resolution).join(' ')}
            {video.status === 'PROCESSING' && '…'}
          </span>
        ) : video.status === 'FAILED' ? (
          <Link href={`/videos/${video.id}`} className="text-xs font-medium text-accent-soft hover:underline">
            See why &amp; reprocess
          </Link>
        ) : (
          <span className="font-mono text-[11px] text-ink-muted">waiting for a worker</span>
        )}
      </div>
    </article>
  );
}

export function VideoCardSkeleton() {
  return (
    <article aria-hidden="true" className="flex flex-col overflow-hidden rounded-card border border-surface-border bg-surface">
      <div className="aspect-video bg-surface-inset" />
      <div className="flex flex-col gap-2.5 p-3">
        <div className="h-3 w-3/4 rounded bg-surface-inset" />
        <div className="h-2.5 w-1/2 rounded bg-surface-inset" />
        <div className="h-2.5 w-2/5 rounded bg-surface-inset" />
      </div>
    </article>
  );
}
