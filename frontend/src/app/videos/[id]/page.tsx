'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Video } from '@/lib/api';
import { isWatchable } from '@/components/VideoCard';
import {
  Alert,
  Button,
  ButtonLink,
  Field,
  Panel,
  ProgressBar,
  StatusBadge,
  formatBytes,
  formatDuration,
  inputClass,
} from '@/components/ui';

const ACTIVE: Video['status'][] = ['PENDING', 'PROCESSING'];

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', description: '', isPublic: false });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobError, setJobError] = useState<string | null>(null);
  const [allowUpscale, setAllowUpscale] = useState(false);
  const [embedQuality, setEmbedQuality] = useState('auto');
  const [embedAutoplay, setEmbedAutoplay] = useState(false);
  const [embedMuted, setEmbedMuted] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api.getVideo(params.id);
      setVideo(next);
      if (!dirty) {
        setDraft({
          title: next.title,
          description: next.description ?? '',
          isPublic: next.isPublic,
        });
      }
      const status = await api.getStatus(params.id).catch(() => null);
      if (status) {
        setProgress(status.progress);
        setJobError(status.errorMessage);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this video');
    }
  }, [params.id, dirty]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (!video || !ACTIVE.includes(video.status)) return;
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
  }, [video, load]);

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

  const watchable = isWatchable(video);
  const inFlight = ACTIVE.includes(video.status);

  const embedSrc = (() => {
    const base = video.embedUrl ?? '';
    if (!base) return '';
    const qs = new URLSearchParams();
    if (embedQuality !== 'auto') qs.set('quality', embedQuality);
    if (embedAutoplay) qs.set('autoplay', '1');
    if (embedMuted) qs.set('muted', '1');
    const query = qs.toString();
    return query ? `${base}?${query}` : base;
  })();

  const tallest = video.resolutions.at(-1);
  const isPortrait = tallest !== undefined && tallest.height > tallest.width;
  const snippet = `<iframe\n  src="${embedSrc}"\n  width="${isPortrait ? 360 : 640}" height="${isPortrait ? 640 : 360}"\n  frameborder="0"\n  allowfullscreen></iframe>`;

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateVideo(video!.id, {
        title: draft.title,
        description: draft.description,
        isPublic: draft.isPublic,
      });
      setVideo(updated);
      setDirty(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function reprocess() {
    await api.reprocess(video!.id, allowUpscale);
    await load();
  }

  async function remove() {
    await api.deleteVideo(video!.id);
    router.push('/library');
  }

  return (
    <>
      <Link href="/library" className="inline-flex items-center gap-1.5 self-start text-sm text-accent-soft hover:underline">
        <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Library
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2.5">
          <h1 className="text-[28px] font-semibold tracking-tight">{video.title}</h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={video.status} watchable={watchable} />
            <span className="font-mono text-xs text-ink-muted">
              {video.duration !== null && `${formatDuration(video.duration)} · `}
              {formatBytes(video.fileSize)} source
              {tallest && ` · up to ${tallest.width}×${tallest.height}`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {video.playbackUrl && (
            <ButtonLink href={`/player/${video.id}`} variant="secondary">
              Watch
            </ButtonLink>
          )}
          <Button disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      {video.status === 'FAILED' && (
        <Alert
          tone="error"
          title="Encoding failed"
          action={
            <Button variant="secondary" onClick={() => void reprocess()}>
              Try again
            </Button>
          }
        >
          {jobError ? (
            <>
              <code className="font-mono">{jobError}</code> — the file may be audio only, or its video track uses a
              codec ffmpeg could not open. Re-exporting as H.264 MP4 usually fixes it.
            </>
          ) : (
            'The worker gave up after its retries. Re-exporting as H.264 MP4 usually fixes it.'
          )}
        </Alert>
      )}

      {inFlight && (
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-status-processing">
              {watchable ? 'Watchable now, still improving' : 'Encoding'}
            </span>
            <span className="font-mono text-[13px] text-ink-soft">{progress}%</span>
          </div>
          <ProgressBar percent={progress} label="Encoding progress" />
        </Panel>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[320px] flex-[999_1_560px] flex-col gap-5">
          <Panel className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">Details</h2>
            <Field label="Title" htmlFor="d-title">
              <input
                id="d-title"
                type="text"
                value={draft.title}
                onChange={(event) => {
                  setDraft({ ...draft, title: event.target.value });
                  setDirty(true);
                }}
                className={inputClass}
              />
            </Field>
            <Field label="Description" htmlFor="d-desc">
              <textarea
                id="d-desc"
                rows={3}
                value={draft.description}
                onChange={(event) => {
                  setDraft({ ...draft, description: event.target.value });
                  setDirty(true);
                }}
                className={`${inputClass} min-h-[88px] resize-y py-2.5`}
              />
            </Field>
          </Panel>

          <Panel className="flex flex-col gap-3.5">
            <h2 className="text-base font-semibold">Who can watch</h2>
            {(
              [
                [true, 'Public', 'Anyone with the link can watch. Served straight from storage and embeddable on other sites.'],
                [false, 'Private', 'Only you and administrators. Playback runs through an expiring link, so it cannot be embedded elsewhere.'],
              ] as const
            ).map(([value, label, body]) => (
              <label
                key={label}
                className={`flex cursor-pointer gap-3 rounded-[10px] p-3.5 ${
                  draft.isPublic === value ? 'border-2 border-accent bg-accent/[0.09]' : 'border border-surface-border'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={draft.isPublic === value}
                  onChange={() => {
                    setDraft({ ...draft, isPublic: value });
                    setDirty(true);
                  }}
                  className="mt-0.5 h-[17px] w-[17px] shrink-0 cursor-pointer accent-accent"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-[13px] leading-relaxed text-ink-muted">{body}</span>
                </span>
              </label>
            ))}
          </Panel>

          <Panel className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold">Renditions</h2>
              {tallest && (
                <span className="text-[13px] text-ink-muted">
                  Capped at the source&rsquo;s shorter side — {Math.min(tallest.width, tallest.height)} px
                </span>
              )}
            </div>

            {video.resolutions.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Nothing encoded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left">
                      {['Quality', 'Resolution', 'Bitrate'].map((head) => (
                        <th key={head} scope="col" className="border-b border-surface-border py-2.5 pr-3 font-semibold text-ink-muted">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {video.resolutions.map((r) => (
                      <tr key={r.resolution}>
                        <td className="border-b border-surface-border/60 py-2.5 pr-3">{r.resolution}</td>
                        <td className="border-b border-surface-border/60 py-2.5 pr-3 text-ink-soft">
                          {r.width}×{r.height}
                        </td>
                        <td className="border-b border-surface-border/60 py-2.5 pr-3 text-ink-soft">
                          {r.bitrate >= 1_000_000
                            ? `${(r.bitrate / 1_000_000).toFixed(1)} Mbps`
                            : `${Math.round(r.bitrate / 1000)} kbps`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-surface-border pt-3.5">
              <Button variant="secondary" onClick={() => void reprocess()}>
                Reprocess
              </Button>
              <label htmlFor="upscale" className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-soft">
                <input
                  id="upscale"
                  type="checkbox"
                  checked={allowUpscale}
                  onChange={(event) => setAllowUpscale(event.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-status-processing"
                />
                Also produce 1080p and 4K
              </label>
            </div>
            {allowUpscale && (
              <p className="text-[13px] leading-relaxed text-status-processing">
                Those rungs would be upscaled: the 4K variant costs roughly 21× the bandwidth of 360p and carries no
                extra detail. Useful for testing the quality menu, not for quality.
              </p>
            )}
          </Panel>
        </div>

        <aside className="flex min-w-[280px] flex-[1_1_340px] flex-col gap-5">
          <div className="overflow-hidden rounded-card border border-surface-border bg-surface">
            <div className="flex aspect-video items-center justify-center bg-ground">
              {video.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.posterUrl} alt="" className="h-full object-contain" />
              ) : (
                <span className="text-[13px] text-ink-muted">No thumbnail yet</span>
              )}
            </div>
            {isPortrait && (
              <p className="p-3 text-[13px] text-ink-muted">Vertical source, letterboxed in a 16:9 frame.</p>
            )}
          </div>

          <Panel className="flex flex-col gap-3.5">
            <h2 className="text-base font-semibold">Embed</h2>

            {!video.isPublic ? (
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Private videos cannot be embedded: a third-party page has no way to hold the token their playback link
                requires. Make this video public to get a snippet.
              </p>
            ) : !video.embedUrl ? (
              <p className="text-[13px] text-ink-muted">Available once the first rendition has encoded.</p>
            ) : (
              <>
                <Field label="Start quality" htmlFor="e-quality">
                  <select
                    id="e-quality"
                    value={embedQuality}
                    onChange={(event) => setEmbedQuality(event.target.value)}
                    className={inputClass}
                  >
                    <option value="auto">Auto — adapts to bandwidth</option>
                    {video.resolutions.map((r) => (
                      <option key={r.resolution} value={r.resolution}>
                        {r.resolution} — pinned
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="flex flex-wrap gap-4">
                  <label htmlFor="e-auto" className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-soft">
                    <input id="e-auto" type="checkbox" checked={embedAutoplay} onChange={(e) => setEmbedAutoplay(e.target.checked)} className="h-4 w-4 cursor-pointer accent-accent" />
                    Autoplay
                  </label>
                  <label htmlFor="e-mute" className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-soft">
                    <input id="e-mute" type="checkbox" checked={embedMuted} onChange={(e) => setEmbedMuted(e.target.checked)} className="h-4 w-4 cursor-pointer accent-accent" />
                    Muted
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[13px] text-ink-muted">Snippet</span>
                  <pre className="overflow-x-auto rounded-control border border-surface-border bg-ground p-3 font-mono text-xs leading-relaxed text-ink-soft">
                    {snippet}
                  </pre>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      void navigator.clipboard.writeText(snippet).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                  >
                    {copied ? 'Copied' : 'Copy snippet'}
                  </Button>
                </div>

                <Alert tone="warning">
                  The embedding site&rsquo;s domain must be on the allowed-origins list, or the player loads and then
                  fails to stream.{' '}
                  <Link href="/settings" className="font-medium underline">
                    Manage origins
                  </Link>
                </Alert>
              </>
            )}
          </Panel>

          <div className="flex flex-col gap-2.5 rounded-card border border-status-failed/36 bg-status-failed/[0.06] p-5">
            <h2 className="text-[15px] font-semibold text-status-failed">Delete this video</h2>
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Removes every rendition, thumbnail and the original, and frees {formatBytes(video.fileSize)}. Embeds and
              shared links break immediately. This cannot be undone.
            </p>
            <Button
              variant="destructive"
              className="self-start"
              onClick={() => {
                if (window.confirm(`Delete “${video.title}”? This cannot be undone.`)) void remove();
              }}
            >
              Delete video
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
