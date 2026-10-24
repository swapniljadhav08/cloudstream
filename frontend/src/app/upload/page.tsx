'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Me, type Video } from '@/lib/api';
import {
  Alert,
  Button,
  ButtonLink,
  PageHeader,
  Panel,
  ProgressBar,
  Field,
  formatBytes,
  inputClass,
  quotaState,
} from '@/components/ui';

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'];
/** 5 GB, matching docs/31_File_Upload_Policy.md and the API's limit. */
const MAX_FILE_SIZE = 5_368_709_120;

type Rejection = { name: string; reason: string; fix?: string };

type QueueItem = {
  key: string;
  file: File;
  title: string;
  isPublic: boolean;
  percent: number;
  state: 'waiting' | 'uploading' | 'done' | 'error';
  error?: string;
  videoId?: string;
};

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [dragging, setDragging] = useState(false);
  const [encoding, setEncoding] = useState<Video[]>([]);

  const loadMe = useCallback(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(loadMe, [loadMe]);

  // Watch anything still encoding from this batch, so the page can say
  // "watchable" the moment the first rendition lands.
  useEffect(() => {
    const ids = queue.filter((item) => item.videoId).map((item) => item.videoId!);
    if (ids.length === 0) return;

    const timer = setInterval(() => {
      void (async () => {
        const results = await Promise.all(ids.map((id) => api.getVideo(id).catch(() => null)));
        setEncoding(results.filter((v): v is Video => v !== null));
      })();
    }, 2500);

    return () => clearInterval(timer);
  }, [queue]);

  const used = me?.storageUsed ?? 0;
  const quota = me?.storageQuota ?? 0;
  const queuedBytes = queue
    .filter((item) => item.state === 'waiting' || item.state === 'uploading')
    .reduce((sum, item) => sum + item.file.size, 0);
  const remaining = Math.max(0, quota - used);
  const blocked = quota > 0 && used >= quota;

  /**
   * Validates on selection, before a single byte moves.
   *
   * Type, size and quota are all knowable up front, so a 5 GB transfer should
   * never be spent discovering the file was never going to be accepted.
   */
  function accept(files: FileList | File[]) {
    const incoming = Array.from(files);
    const nextRejections: Rejection[] = [];
    const accepted: QueueItem[] = [];

    let projected = used + queuedBytes;

    for (const file of incoming) {
      const dot = file.name.lastIndexOf('.');
      const ext = dot === -1 ? '' : file.name.slice(dot).toLowerCase();

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        nextRejections.push({
          name: file.name,
          reason: 'not a video',
          fix: `Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`,
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        nextRejections.push({
          name: file.name,
          reason: `${formatBytes(file.size)}, over the ${formatBytes(MAX_FILE_SIZE)} limit`,
          fix: 'Export at a lower bitrate first.',
        });
        continue;
      }

      if (quota > 0 && projected + file.size > quota) {
        nextRejections.push({
          name: file.name,
          reason: `${formatBytes(file.size)} would exceed your remaining ${formatBytes(Math.max(0, quota - projected))}`,
          fix: 'Delete something first.',
        });
        continue;
      }

      projected += file.size;
      accepted.push({
        key: `${file.name}-${file.size}-${Date.now()}-${accepted.length}`,
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        isPublic: false,
        percent: 0,
        state: 'waiting',
      });
    }

    setRejections(nextRejections);
    setQueue((prev) => [...prev, ...accepted]);
  }

  // One at a time: parallel uploads of multi-gigabyte files just make each
  // other slower and the progress unreadable.
  useEffect(() => {
    const next = queue.find((item) => item.state === 'waiting');
    const inFlight = queue.some((item) => item.state === 'uploading');
    if (!next || inFlight) return;

    const patch = (changes: Partial<QueueItem>) =>
      setQueue((prev) => prev.map((item) => (item.key === next.key ? { ...item, ...changes } : item)));

    patch({ state: 'uploading' });

    void api
      .upload(next.file, { title: next.title, isPublic: next.isPublic }, (percent) => patch({ percent }))
      .then((video) => {
        patch({ state: 'done', percent: 100, videoId: video.id });
        loadMe();
      })
      .catch((err: unknown) => {
        patch({
          state: 'error',
          error: err instanceof ApiError ? err.message : 'Upload failed',
        });
      });
  }, [queue, loadMe]);

  return (
    <>
      <PageHeader
        title="Upload"
        subtitle="Files start encoding the moment they land. You can leave this page."
        action={<ButtonLink href="/library" variant="secondary">Back to library</ButtonLink>}
      />

      {blocked && (
        <Alert tone="error" title="Storage is full — uploads are blocked">
          You have used all {formatBytes(quota)}. Delete a video to make room.{' '}
          <Link href="/settings" className="font-medium underline">
            Manage storage
          </Link>
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[320px] flex-[999_1_560px] flex-col gap-5">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!blocked) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!blocked) accept(event.dataTransfer.files);
            }}
            className={`flex flex-col items-center gap-4 rounded-[14px] border-2 border-dashed px-8 py-11 text-center ${
              blocked
                ? 'border-surface-border bg-surface opacity-60'
                : dragging
                  ? 'border-accent bg-accent/[0.07]'
                  : 'border-surface-border bg-surface'
            }`}
          >
            <svg viewBox="0 0 24 24" className={`h-10 w-10 ${blocked ? 'text-ink-muted' : 'text-accent'}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4" />
              <path d="M7 9l5-5 5 5" />
              <path d="M4 18h16" />
            </svg>
            <span className="text-lg font-semibold">
              {blocked ? 'No space left' : dragging ? 'Drop to upload' : 'Drag files here'}
            </span>
            <Button
              variant="primary"
              disabled={blocked}
              onClick={() => inputRef.current?.click()}
            >
              Choose files
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ALLOWED_EXTENSIONS.join(',')}
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) accept(event.target.files);
                event.target.value = '';
              }}
            />
            <span className="text-[13px] text-ink-muted">
              MP4, MOV, MKV, WebM, AVI, FLV · up to {formatBytes(MAX_FILE_SIZE)} each
            </span>
          </div>

          {rejections.length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-card border border-status-failed/40 bg-status-failed/[0.07] p-4">
              <span className="text-sm font-semibold text-status-failed">
                {rejections.length} {rejections.length === 1 ? 'file was' : 'files were'} not accepted
              </span>
              <ul className="flex flex-col gap-2">
                {rejections.map((rejection) => (
                  <li key={rejection.name} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="font-mono text-[13px] text-ink-soft">{rejection.name}</span>
                    <span className="text-[13px] text-ink-muted">— {rejection.reason}.</span>
                    {rejection.fix && <span className="text-[13px] text-ink-muted">{rejection.fix}</span>}
                  </li>
                ))}
              </ul>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                All of these are refused before a single byte is sent — type, size and quota are checked on selection,
                not after the transfer.
              </p>
            </div>
          )}

          {queue.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-[17px] font-semibold">This batch</h2>

              {queue.map((item) => {
                const video = encoding.find((v) => v.id === item.videoId);
                const watchable = video !== undefined && video.resolutions.length > 0;

                return (
                  <Panel key={item.key} className="flex flex-col gap-3.5">
                    <div className="flex flex-wrap items-center gap-3.5">
                      <div className="h-12 w-[84px] shrink-0 rounded-md bg-surface-inset" />

                      <div className="flex min-w-[200px] flex-[999_1_220px] flex-col gap-1.5">
                        <span className="truncate font-mono text-[13px] text-ink-soft">{item.file.name}</span>
                        <div className="flex items-baseline justify-between gap-3">
                          <span
                            className={`text-[13px] font-medium ${
                              item.state === 'error'
                                ? 'text-status-failed'
                                : watchable
                                  ? 'text-status-ready'
                                  : item.state === 'uploading'
                                    ? 'text-accent-soft'
                                    : 'text-ink-muted'
                            }`}
                          >
                            {item.state === 'error'
                              ? item.error
                              : item.state === 'waiting'
                                ? 'Waiting its turn'
                                : item.state === 'uploading'
                                  ? `Uploading — ${formatBytes(item.file.size * (item.percent / 100))} of ${formatBytes(item.file.size)}`
                                  : watchable
                                    ? `Watchable now — ${video!.resolutions[0].resolution} ready`
                                    : 'Queued for encoding'}
                          </span>
                          <span className="shrink-0 font-mono text-[13px] text-ink-soft">
                            {item.state === 'uploading' ? `${item.percent}%` : formatBytes(item.file.size)}
                          </span>
                        </div>
                        {item.state !== 'error' && (
                          <ProgressBar
                            percent={item.state === 'done' ? 100 : item.percent}
                            tone="accent"
                            label={`Upload progress for ${item.file.name}`}
                          />
                        )}
                      </div>

                      {item.videoId && video?.playbackUrl ? (
                        <ButtonLink href={`/player/${item.videoId}`} variant="secondary" className="shrink-0">
                          Watch
                        </ButtonLink>
                      ) : item.state === 'waiting' ? (
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${item.file.name} from the queue`}
                          className="shrink-0 !min-h-[40px] !px-3"
                          onClick={() => setQueue((prev) => prev.filter((q) => q.key !== item.key))}
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </Button>
                      ) : null}
                    </div>

                    {/* Metadata is editable while the bytes are still moving. */}
                    {(item.state === 'waiting' || item.state === 'uploading') && (
                      <div className="grid gap-3 border-t border-surface-border pt-3.5 sm:grid-cols-2">
                        <Field label="Title" htmlFor={`title-${item.key}`}>
                          <input
                            id={`title-${item.key}`}
                            type="text"
                            value={item.title}
                            onChange={(event) =>
                              setQueue((prev) =>
                                prev.map((q) => (q.key === item.key ? { ...q, title: event.target.value } : q)),
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Visibility" htmlFor={`vis-${item.key}`}>
                          <select
                            id={`vis-${item.key}`}
                            value={item.isPublic ? 'public' : 'private'}
                            disabled={item.state === 'uploading'}
                            onChange={(event) =>
                              setQueue((prev) =>
                                prev.map((q) =>
                                  q.key === item.key ? { ...q, isPublic: event.target.value === 'public' } : q,
                                ),
                              )
                            }
                            className={inputClass}
                          >
                            <option value="private">Private — expiring links only</option>
                            <option value="public">Public — anyone with the link</option>
                          </select>
                        </Field>
                      </div>
                    )}
                  </Panel>
                );
              })}
            </div>
          )}
        </div>

        <aside className="flex min-w-[260px] flex-[1_1_300px] flex-col gap-4">
          <Panel className="flex flex-col gap-3.5">
            <span className="text-sm font-semibold">
              {queuedBytes > 0 ? 'Storage after this batch' : 'Storage'}
            </span>
            <div className="flex flex-col gap-2">
              <span
                className={`text-[13px] font-medium ${
                  quotaState(used + queuedBytes, quota) === 'normal' ? 'text-ink-muted' : 'text-status-processing'
                }`}
              >
                {formatBytes(used + queuedBytes)} of {formatBytes(quota)}
                {quota > 0 && ` — ${Math.round(((used + queuedBytes) / quota) * 100)}%`}
              </span>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-inset">
                <div className="h-full bg-accent" style={{ width: `${quota > 0 ? (used / quota) * 100 : 0}%` }} />
                <div
                  className="h-full bg-accent/40"
                  style={{ width: `${quota > 0 ? (queuedBytes / quota) * 100 : 0}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-3.5 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-accent" />
                  In use {formatBytes(used)}
                </span>
                {queuedBytes > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-accent/40" />
                    This batch {formatBytes(queuedBytes)}
                  </span>
                )}
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              {queuedBytes > 0
                ? 'The projected total is shown before you commit, so a batch cannot silently fill the account.'
                : `${formatBytes(remaining)} remaining.`}
            </p>
          </Panel>

          <Panel className="flex flex-col gap-3">
            <span className="text-sm font-semibold">What happens next</span>
            <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[13px] leading-relaxed text-ink-soft">
              <li>The file streams straight to storage — it never sits on an API server.</li>
              <li>A worker probes it and builds a ladder capped at your source resolution.</li>
              <li>The smallest rendition lands first, so playback opens in seconds.</li>
              <li>Thumbnails and a preview clip are generated last.</li>
            </ol>
          </Panel>

          <Alert tone="warning">
            Closing the tab mid-upload loses that transfer — resumable upload is not built yet. Encoding, once started,
            finishes without you.
          </Alert>
        </aside>
      </div>
    </>
  );
}
