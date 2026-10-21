'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Video } from '@/lib/api';
import { VideoPlayer } from '@/components/VideoPlayer';

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getVideo(params.id)
      .then(setVideo)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load video'),
      );
  }, [params.id]);

  const onProgress = useCallback(
    (position: number, duration: number) => {
      // Best effort: losing a progress ping should not interrupt playback.
      void api.saveProgress(params.id, position, duration).catch(() => undefined);
    },
    [params.id],
  );

  if (error) {
    return (
      <div>
        <p className="text-red-400">{error}</p>
        <Link href="/library" className="text-sm text-sky-400 hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  if (!video) return <p className="text-slate-400">Loading...</p>;

  return (
    <div className="space-y-5">
      <Link href="/library" className="text-sm text-sky-400 hover:underline">
        &larr; Library
      </Link>

      {video.playbackUrl ? (
        <VideoPlayer
          src={video.playbackUrl}
          poster={video.posterUrl}
          qualities={video.resolutions.map((r) => r.resolution)}
          onProgress={onProgress}
        />
      ) : (
        <div className="rounded border border-surface-border bg-surface-raised p-8 text-center text-slate-400">
          This video is still being processed ({video.status}).
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold">{video.title}</h1>
        {video.description && <p className="mt-2 text-slate-300">{video.description}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Status" value={video.status} />
          <Stat label="Duration" value={video.duration ? `${video.duration}s` : '-'} />
          <Stat
            label="Renditions"
            value={video.resolutions.map((r) => r.resolution).join(', ') || '-'}
          />
          <Stat label="Visibility" value={video.isPublic ? 'Public' : 'Private'} />
        </dl>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}
