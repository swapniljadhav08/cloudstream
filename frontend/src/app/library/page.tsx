'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, tokens, type Video } from '@/lib/api';
import { UploadForm } from '@/components/UploadForm';

const ACTIVE: Video['status'][] = ['PENDING', 'PROCESSING'];

export default function LibraryPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const reload = useCallback(async (term?: string) => {
    const { videos: list } = await api.listVideos({ limit: 50, search: term || undefined });
    setVideos(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!tokens.access) {
      router.push('/auth/login');
      return;
    }
    reload().catch(() => setLoading(false));
  }, [reload, router]);

  // Poll only while something is actually being processed, and stop as soon as
  // the queue drains, so an idle library issues no background requests.
  useEffect(() => {
    const pending = videos.filter((v) => ACTIVE.includes(v.status));
    if (pending.length === 0) return;

    const timer = setInterval(() => {
      void (async () => {
        const results = await Promise.all(
          pending.map((v) => api.getStatus(v.id).catch(() => null)),
        );

        setProgress((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r) next[r.videoId] = r.progress;
          }
          return next;
        });

        // A status change means the list itself is stale.
        if (results.some((r) => r && !ACTIVE.includes(r.status))) {
          await reload(search);
        }
      })();
    }, 2000);

    return () => clearInterval(timer);
  }, [videos, reload, search]);

  async function onDelete(id: string) {
    await api.deleteVideo(id);
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div>
      <UploadForm onUploaded={(video) => setVideos((prev) => [video, ...prev])} />

      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Library</h1>
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            void reload(e.target.value);
          }}
          className="ml-auto rounded border border-surface-border bg-surface-raised px-3 py-1.5 text-sm"
        />
      </div>

      {loading && <p className="text-slate-400">Loading...</p>}
      {!loading && videos.length === 0 && (
        <p className="text-slate-400">Nothing here yet. Upload a video to get started.</p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <li
            key={video.id}
            className="overflow-hidden rounded-lg border border-surface-border bg-surface-raised"
          >
            <div className="aspect-video bg-surface">
              {video.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.posterUrl}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  {video.status === 'FAILED' ? 'Processing failed' : 'Processing...'}
                </div>
              )}
            </div>

            <div className="space-y-2 p-4">
              <h2 className="truncate font-medium" title={video.title}>
                {video.title}
              </h2>

              <div className="flex items-center gap-2 text-xs">
                <StatusBadge status={video.status} />
                {video.duration !== null && (
                  <span className="text-slate-400">{formatDuration(video.duration)}</span>
                )}
                {video.resolutions.length > 0 && (
                  <span className="text-slate-500">
                    {video.resolutions.map((r) => r.resolution).join(' / ')}
                  </span>
                )}
              </div>

              {ACTIVE.includes(video.status) && (
                <div className="h-1.5 overflow-hidden rounded bg-surface">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${progress[video.id] ?? 0}%` }}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1 text-sm">
                {video.playbackUrl && (
                  <Link href={`/player/${video.id}`} className="text-sky-400 hover:underline">
                    Watch
                  </Link>
                )}
                <button
                  onClick={() => void onDelete(video.id)}
                  className="ml-auto text-slate-400 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: Video['status'] }) {
  const tone: Record<Video['status'], string> = {
    PENDING: 'bg-slate-600',
    PROCESSING: 'bg-amber-600',
    COMPLETED: 'bg-emerald-600',
    FAILED: 'bg-red-600',
    CANCELLED: 'bg-slate-700',
  };
  return <span className={`rounded px-1.5 py-0.5 text-white ${tone[status]}`}>{status}</span>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
