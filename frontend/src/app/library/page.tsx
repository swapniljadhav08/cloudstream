'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Video, type VideoStatus } from '@/lib/api';
import { VideoCard, VideoCardSkeleton } from '@/components/VideoCard';
import { Button, ButtonLink, EmptyState, PageHeader, formatBytes, inputClass } from '@/components/ui';

const ACTIVE: VideoStatus[] = ['PENDING', 'PROCESSING'];
const PAGE_SIZE = 12;

type Filter = 'ALL' | 'COMPLETED' | 'ACTIVE' | 'FAILED';

export default function LibraryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (opts: { page?: number; search?: string; filter?: Filter } = {}) => {
      const nextPage = opts.page ?? page;
      const nextSearch = opts.search ?? search;
      const nextFilter = opts.filter ?? filter;

      // PENDING and PROCESSING are one concept to a user, but two values to
      // the API, so "Encoding" filters client-side over a wider fetch.
      const status = nextFilter === 'COMPLETED' || nextFilter === 'FAILED' ? nextFilter : undefined;

      const { videos: list, pagination } = await api.listVideos({
        page: nextPage,
        limit: PAGE_SIZE,
        search: nextSearch || undefined,
        status,
      });

      setVideos(list);
      setTotal(pagination?.total ?? list.length);
      setLoading(false);
    },
    [page, search, filter],
  );

  useEffect(() => {
    reload().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const shown = useMemo(
    () => (filter === 'ACTIVE' ? videos.filter((v) => ACTIVE.includes(v.status)) : videos),
    [videos, filter],
  );

  const counts = useMemo(
    () => ({
      ALL: total,
      COMPLETED: videos.filter((v) => v.status === 'COMPLETED').length,
      ACTIVE: videos.filter((v) => ACTIVE.includes(v.status)).length,
      FAILED: videos.filter((v) => v.status === 'FAILED').length,
    }),
    [videos, total],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sizeOnPage = videos.reduce((sum, v) => sum + v.fileSize, 0);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function bulk(action: 'public' | 'private' | 'delete') {
    setBusy(true);
    try {
      const ids = [...selected];
      if (action === 'delete') {
        await Promise.all(ids.map((id) => api.deleteVideo(id).catch(() => undefined)));
      } else {
        await Promise.all(
          ids.map((id) => api.updateVideo(id, { isPublic: action === 'public' }).catch(() => undefined)),
        );
      }
      setSelected(new Set());
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function applyFilter(next: Filter) {
    setFilter(next);
    setPage(1);
    void reload({ filter: next, page: 1 });
  }

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
    void reload({ search: next, page: 1 });
  }

  function goTo(next: number) {
    setPage(next);
    void reload({ page: next });
  }

  return (
    <>
      <PageHeader
        title="Library"
        subtitle={loading ? 'Loading…' : `${total} videos · ${formatBytes(sizeOnPage)} on this page`}
        action={<ButtonLink href="/upload">Upload</ButtonLink>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex min-w-[260px] flex-[1_1_280px] items-center">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 h-4 w-4 text-ink-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5L21 21" />
          </svg>
          <label htmlFor="q" className="sr-only">
            Search videos
          </label>
          <input
            id="q"
            type="search"
            value={search}
            onChange={(event) => applySearch(event.target.value)}
            placeholder="Search titles and descriptions"
            className={`${inputClass} pl-10`}
          />
        </div>

        <div
          role="group"
          aria-label="Filter by status"
          className="flex gap-1 rounded-[9px] border border-surface-border bg-surface p-1"
        >
          {(
            [
              ['ALL', 'All'],
              ['COMPLETED', 'Ready'],
              ['ACTIVE', 'Encoding'],
              ['FAILED', 'Failed'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => applyFilter(key)}
              className={`min-h-[36px] rounded-md px-3 text-[13px] ${
                filter === key
                  ? 'bg-accent/15 font-semibold text-accent-soft'
                  : key === 'FAILED'
                    ? 'text-status-failed hover:bg-surface-inset'
                    : key === 'ACTIVE'
                      ? 'text-status-processing hover:bg-surface-inset'
                      : 'text-ink-soft hover:bg-surface-inset'
              }`}
            >
              {label} {counts[key]}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-card border border-accent/40 bg-accent/10 p-3.5">
          <span className="text-sm font-semibold text-accent-soft">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void bulk('public')}>
              Make public
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void bulk('private')}>
              Make private
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void bulk('delete')}>
              Delete {selected.size}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        search || filter !== 'ALL' ? (
          <EmptyState
            title="Nothing matches"
            body="No videos match that search or filter. Clear it to see your whole library."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  applyFilter('ALL');
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Your library is empty"
            body="Upload a video and it will come back as an adaptive ladder. Most clips are watchable within seconds of the upload finishing."
            action={<ButtonLink href="/upload">Upload your first video</ButtonLink>}
            footnote="MP4, MOV, MKV, WebM, AVI or FLV · up to 5 GB"
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              progress={progress[video.id]}
              selected={selected.has(video.id)}
              onSelect={(checked) => toggle(video.id, checked)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <span className="text-sm text-ink-muted">
            Page {page} of {totalPages} · {total} videos
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => goTo(page - 1)}>
              Previous
            </Button>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
