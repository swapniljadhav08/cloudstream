'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, type Video } from '@/lib/api';
import { VideoPlayer } from '@/components/VideoPlayer';

/**
 * Standalone player for embedding in another site via <iframe>.
 *
 * Intentionally chrome-free and unauthenticated: it only ever works for public
 * videos, because a private one needs a bearer token that a third-party page
 * has no way to supply. Query parameters:
 *
 *   ?quality=720p   pin a rendition instead of adaptive switching
 *   ?autoplay=1     start immediately (browsers require muted to allow this)
 *   ?muted=1        start muted
 */
export default function EmbedPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quality = search.get('quality');
  const autoplay = search.get('autoplay') === '1';
  // Autoplay is blocked unless the video is muted, so imply it.
  const muted = search.get('muted') === '1' || autoplay;

  useEffect(() => {
    api
      .getVideo(params.id)
      .then(setVideo)
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError && err.status === 401
            ? 'This video is private and cannot be embedded.'
            : err instanceof ApiError
              ? err.message
              : 'Could not load video',
        ),
      );
  }, [params.id]);

  if (error) {
    return <div className="p-4 text-sm text-red-400">{error}</div>;
  }

  if (!video) {
    return <div className="p-4 text-sm text-slate-400">Loading...</div>;
  }

  if (!video.playbackUrl) {
    return (
      <div className="p-4 text-sm text-slate-400">
        This video is still being processed ({video.status}).
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black">
      <VideoPlayer
        src={video.playbackUrl}
        poster={video.posterUrl}
        qualities={video.resolutions.map((r) => r.resolution)}
        initialQuality={quality}
        autoPlay={autoplay}
        muted={muted}
      />
    </div>
  );
}
