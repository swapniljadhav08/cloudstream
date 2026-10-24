'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Me, type Video } from '@/lib/api';
import {
  Alert,
  ButtonLink,
  PageHeader,
  Panel,
  QuotaMeter,
  formatBytes,
  inputClass,
  quotaState,
} from '@/components/ui';

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    void Promise.all([api.me(), api.listVideos({ limit: 100 })])
      .then(([profile, list]) => {
        setMe(profile);
        setVideos(list.videos);
      })
      .catch(() => undefined);
  }, []);

  if (!me) return <p className="text-ink-muted">Loading…</p>;

  const state = quotaState(me.storageUsed, me.storageQuota);
  // Sorted by size, not date: when someone needs space they need the big files.
  const largest = [...videos].sort((a, b) => b.fileSize - a.fileSize).slice(0, 5);
  const biggest = largest[0]?.fileSize ?? 1;

  return (
    <>
      <PageHeader title="Account" subtitle="Profile, storage and API access." />

      {state !== 'normal' && (
        <Alert
          tone={state === 'full' ? 'error' : 'warning'}
          title={state === 'full' ? 'Storage is full' : 'Storage is nearly full'}
        >
          {state === 'full'
            ? 'Uploads are blocked until you delete something.'
            : `You have used ${formatBytes(me.storageUsed)} of ${formatBytes(me.storageQuota)}. Uploads still work for now.`}
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[320px] flex-[999_1_520px] flex-col gap-5">
          <Panel className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">Profile</h2>
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-accent text-xl font-semibold text-ground">
                {me.name
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-[15px] font-semibold">{me.name}</span>
                <span className="truncate text-[13px] text-ink-muted">{me.email}</span>
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="p-name" className="text-[13px] font-medium text-ink-muted">
                  Name
                </label>
                <input id="p-name" type="text" defaultValue={me.name} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="p-email" className="text-[13px] font-medium text-ink-muted">
                  Email
                </label>
                <input id="p-email" type="email" defaultValue={me.email} className={inputClass} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 rounded-[9px] bg-surface-inset px-3.5 py-3">
              <span className="text-[13px] text-ink-muted">Role</span>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold capitalize text-accent-soft">
                {me.role.toLowerCase().replace('_', ' ')}
              </span>
              <span className="ml-auto text-[13px] text-ink-muted">Only an administrator can change this.</span>
            </div>

            <p className="text-[13px] text-ink-muted">
              Editing a profile is not wired to the API yet — the fields are here so the shape is agreed.
            </p>
          </Panel>

          <Panel className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold">Storage</h2>
              <span className="text-[13px] text-ink-muted">
                {me.videoCount} {me.videoCount === 1 ? 'video' : 'videos'}
              </span>
            </div>

            <QuotaMeter used={me.storageUsed} quota={me.storageQuota} />

            <p className="text-[13px] leading-relaxed text-ink-muted">
              {state === 'normal'
                ? 'Below 80%: no prompts, uploads proceed.'
                : state === 'warning'
                  ? 'Past 80%: a banner appears but uploads still work.'
                  : 'At 100%: the upload button is disabled and the dropzone explains what to delete.'}
            </p>

            {largest.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-surface-border pt-4">
                <span className="text-sm font-semibold">Largest videos</span>
                <div className="flex flex-col gap-2.5">
                  {largest.map((video) => (
                    <div key={video.id} className="flex items-center gap-3">
                      <Link
                        href={`/videos/${video.id}`}
                        className="min-w-0 flex-[1_1_160px] truncate text-[13px] hover:text-accent-soft"
                      >
                        {video.title}
                      </Link>
                      <div className="h-[7px] flex-[2_1_120px] overflow-hidden rounded-full bg-surface-inset">
                        <div className="h-full bg-accent" style={{ width: `${(video.fileSize / biggest) * 100}%` }} />
                      </div>
                      <span className="shrink-0 font-mono text-[13px] text-ink-soft">
                        {formatBytes(video.fileSize)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  Sorted by size, not date — the originals dominate, and they are what frees real space.
                </p>
              </div>
            )}
          </Panel>
        </div>

        <aside className="flex min-w-[280px] flex-[1_1_340px] flex-col gap-5">
          <Panel className="flex flex-col gap-3.5">
            <h2 className="text-base font-semibold">API keys</h2>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              The backend can mint scoped keys, but no management UI is wired up yet. A key is shown once at creation
              and only its hash is stored, so losing one means rotating rather than recovering.
            </p>
            <code className="rounded-control border border-surface-border bg-ground px-3 py-2.5 font-mono text-xs text-ink-muted">
              POST /api/v1/keys/provision
            </code>
          </Panel>

          <Panel className="flex flex-col gap-3.5">
            <h2 className="text-base font-semibold">Embed origins</h2>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Sites allowed to fetch your media. Without an entry the player loads inside an iframe and then fails to
              stream, because the browser blocks the cross-origin segment requests.
            </p>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              This list lives in Terraform today — it is the <code className="font-mono">media_allowed_origins</code>{' '}
              variable on the storage stack, applied to the bucket&rsquo;s CORS rules.
            </p>
            <ButtonLink href="/library" variant="secondary">
              Back to library
            </ButtonLink>
          </Panel>
        </aside>
      </div>
    </>
  );
}
