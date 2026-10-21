'use client';

import { useRef, useState } from 'react';
import { api, ApiError, type Video } from '@/lib/api';

const ACCEPT = '.mp4,.mov,.avi,.mkv,.webm,.flv';

export function UploadForm({ onUploaded }: { onUploaded: (video: Video) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a video file');
      return;
    }

    setError(null);
    setPercent(0);

    try {
      const video = await api.upload(file, { title, description, isPublic }, setPercent);
      onUploaded(video);
      setTitle('');
      setDescription('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setPercent(null);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-8 space-y-4 rounded-lg border border-surface-border bg-surface-raised p-5"
    >
      <h2 className="font-medium">Upload a video</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Title</span>
          <input
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-surface-border bg-surface px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">File</span>
          <input
            ref={fileRef}
            type="file"
            required
            accept={ACCEPT}
            className="w-full rounded border border-surface-border bg-surface px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1 file:text-slate-100"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-slate-300">Description (optional)</span>
        <textarea
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-surface-border bg-surface px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="rounded border-surface-border"
        />
        Make this video public
      </label>

      {percent !== null && (
        <div>
          <div className="h-2 overflow-hidden rounded bg-surface">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-400">Uploading {percent}%</p>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={percent !== null}
        className="rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
      >
        {percent !== null ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  );
}
