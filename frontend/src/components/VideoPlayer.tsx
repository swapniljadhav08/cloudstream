'use client';

import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';

export type VideoPlayerProps = {
  src: string;
  poster?: string | null;
  /**
   * Rendition names from the API, e.g. ["144p","240p","720p"]. Taken from the
   * server rather than re-derived in the browser: the server already names
   * each rung correctly, including for portrait video where the name is the
   * width, not the height.
   */
  qualities?: string[];
  /** Rendition to pin on load. Omitted or "auto" leaves ABR in control. */
  initialQuality?: string | null;
  autoPlay?: boolean;
  muted?: boolean;
  onProgress?: (position: number, duration: number) => void;
};

/** Minimal shape of a VHS representation; typed here to avoid a cast at each use. */
type Representation = {
  id: string;
  width?: number;
  height?: number;
  bandwidth?: number;
  enabled: (value?: boolean) => boolean;
};

function representationsOf(player: Player): Representation[] {
  const tech = (
    player as unknown as {
      tech?: (safely: { IWillNotUseThisInPlugins: boolean }) => {
        vhs?: { representations?: () => Representation[] };
      };
    }
  ).tech?.({ IWillNotUseThisInPlugins: true });

  return tech?.vhs?.representations?.() ?? [];
}

/** A rendition's name is its shorter side, matching how the API labels rungs. */
function labelOf(representation: Representation): string | null {
  const { width, height } = representation;
  if (!width || !height) return null;
  return `${Math.min(width, height)}p`;
}

export function VideoPlayer({
  src,
  poster,
  qualities = [],
  initialQuality,
  autoPlay = false,
  muted = false,
  onProgress,
}: VideoPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  // Held in a ref so changing the callback does not tear down the player.
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  const [selected, setSelected] = useState<string>(initialQuality ?? 'auto');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (playerRef.current || !hostRef.current) return;

    // Video.js replaces the element it is given, so React must not own it.
    // Creating it here keeps React's tree and Video.js's DOM from fighting.
    const element = document.createElement('video-js');
    element.classList.add('vjs-big-play-centered', 'w-full');
    hostRef.current.appendChild(element);

    const player = videojs(element, {
      controls: true,
      fluid: true,
      preload: 'auto',
      autoplay: autoPlay,
      muted,
      playbackRates: [0.5, 1, 1.5, 2],
      html5: {
        vhs: {
          // Start low and climb: picking a high rendition first stalls the
          // opening seconds on a slow connection.
          enableLowInitialPlaylist: true,
        },
      },
    });

    playerRef.current = player;

    // Representations only exist once the master playlist has been parsed.
    player.on('loadedmetadata', () => setReady(true));

    let lastReported = 0;
    player.on('timeupdate', () => {
      const position = Math.floor(player.currentTime() ?? 0);
      const duration = Math.floor(player.duration() ?? 0);

      // Report at most once every 5 seconds: timeupdate fires ~4x a second
      // and each report is a write.
      if (duration > 0 && position - lastReported >= 5) {
        lastReported = position;
        progressRef.current?.(position, duration);
      }
    });

    return () => {
      player.dispose();
      playerRef.current = null;
    };
    // Mount-only: later prop changes are applied by the effects below rather
    // than by rebuilding the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Source changes are applied to the existing player rather than recreating it.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    setReady(false);
    player.src({ src, type: 'application/x-mpegURL' });
    if (poster) player.poster(poster);
  }, [src, poster]);

  // Pinning a quality means enabling exactly that representation and
  // disabling the rest; "auto" re-enables all and hands control back to ABR.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready) return;

    const representations = representationsOf(player);
    if (representations.length === 0) return;

    for (const representation of representations) {
      representation.enabled(selected === 'auto' || labelOf(representation) === selected);
    }
  }, [selected, ready]);

  return (
    <div>
      <div ref={hostRef} data-vjs-player />

      {qualities.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="quality" className="text-slate-400">
            Quality
          </label>
          <select
            id="quality"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="rounded border border-surface-border bg-surface-raised px-2 py-1"
          >
            <option value="auto">Auto (adaptive)</option>
            {qualities.map((quality) => (
              <option key={quality} value={quality}>
                {quality}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            {selected === 'auto'
              ? 'switches with available bandwidth'
              : 'pinned — adaptive switching off'}
          </span>
        </div>
      )}
    </div>
  );
}
