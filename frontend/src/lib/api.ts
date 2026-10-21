'use client';

// Typed client for the backend API.
//
// Every response is the envelope from docs/08_API_Design.md, so unwrapping and
// error mapping live here rather than in each component.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const BASE = `${API_URL}/api/v1`;

const ACCESS_TOKEN_KEY = 'vsp.accessToken';
const REFRESH_TOKEN_KEY = 'vsp.refreshToken';

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type VideoStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type Video = {
  id: string;
  title: string;
  description: string | null;
  status: VideoStatus;
  duration: number | null;
  fileSize: number;
  mimeType: string;
  isPublic: boolean;
  createdAt: string;
  playbackUrl: string | null;
  posterUrl: string | null;
  embedUrl: string | null;
  resolutions: { resolution: string; url: string; width: number; height: number; bitrate: number }[];
};

export type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
  storageUsed: number;
  storageQuota: number;
  videoCount: number;
};

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokens = {
  get access(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set(access: string, refresh?: string): void {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear(): void {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

type Envelope<T> = {
  data: T;
  pagination?: Pagination;
  error?: { code: string; message: string; details?: unknown };
};

async function parse<T>(res: Response): Promise<{ data: T; pagination?: Pagination }> {
  if (res.status === 204) {
    return { data: undefined as T };
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (!res.ok) {
    throw new ApiError(
      body?.error?.code ?? 'INTERNAL_ERROR',
      body?.error?.message ?? `Request failed with status ${res.status}`,
      res.status,
      body?.error?.details,
    );
  }

  return { data: body!.data, pagination: body?.pagination };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryOnExpiry = true,
): Promise<{ data: T; pagination?: Pagination }> {
  const headers = new Headers(init.headers);
  const access = tokens.access;
  if (access) headers.set('Authorization', `Bearer ${access}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  // A 15-minute access token expires mid-session constantly. Refresh once and
  // replay, so the user is not bounced to the login page while working.
  if (res.status === 401 && retryOnExpiry && tokens.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, init, false);
    }
  }

  return parse<T>(res);
}

async function tryRefresh(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });

  if (!res.ok) {
    tokens.clear();
    return false;
  }

  const body = (await res.json()) as Envelope<{ accessToken: string }>;
  tokens.set(body.data.accessToken);
  return true;
}

export const api = {
  async register(email: string, password: string, name: string): Promise<void> {
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  async login(email: string, password: string): Promise<void> {
    const { data } = await request<{ accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    tokens.set(data.accessToken, data.refreshToken);
  },

  async logout(): Promise<void> {
    const refresh = tokens.refresh;
    if (refresh) {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refresh }),
      }).catch(() => undefined);
    }
    tokens.clear();
  },

  async me(): Promise<Me> {
    const { data } = await request<Me>('/users/me');
    return data;
  },

  async listVideos(
    params: { page?: number; limit?: number; search?: string; status?: VideoStatus } = {},
  ): Promise<{ videos: Video[]; pagination?: Pagination }> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);

    const query = qs.toString();
    const { data, pagination } = await request<Video[]>(`/videos${query ? `?${query}` : ''}`);
    return { videos: data, pagination };
  },

  async getVideo(id: string): Promise<Video> {
    const { data } = await request<Video>(`/videos/${id}`);
    return data;
  },

  async getStatus(
    id: string,
  ): Promise<{ videoId: string; status: VideoStatus; progress: number; errorMessage: string | null }> {
    const { data } = await request<{
      videoId: string;
      status: VideoStatus;
      progress: number;
      errorMessage: string | null;
    }>(`/videos/${id}/status`);
    return data;
  },

  async deleteVideo(id: string): Promise<void> {
    await request(`/videos/${id}`, { method: 'DELETE' });
  },

  async saveProgress(id: string, position: number, duration: number): Promise<void> {
    await request(`/videos/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ position, duration }),
    });
  },

  /**
   * Uploads with XMLHttpRequest rather than fetch: fetch exposes no upload
   * progress events, and a multi-gigabyte upload with no progress bar is
   * indistinguishable from a hung one.
   */
  upload(
    file: File,
    meta: { title: string; description?: string; isPublic?: boolean },
    onProgress: (percent: number) => void,
  ): Promise<Video> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.set('title', meta.title);
      if (meta.description) form.set('description', meta.description);
      form.set('isPublic', String(meta.isPublic ?? false));
      form.set('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/videos`);

      const access = tokens.access;
      if (access) xhr.setRequestHeader('Authorization', `Bearer ${access}`);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        const body = (() => {
          try {
            return JSON.parse(xhr.responseText) as Envelope<Video>;
          } catch {
            return null;
          }
        })();

        if (xhr.status >= 200 && xhr.status < 300 && body) {
          resolve(body.data);
          return;
        }

        reject(
          new ApiError(
            body?.error?.code ?? 'INTERNAL_ERROR',
            body?.error?.message ?? `Upload failed with status ${xhr.status}`,
            xhr.status,
            body?.error?.details,
          ),
        );
      });

      xhr.addEventListener('error', () => {
        reject(new ApiError('INTERNAL_ERROR', 'Network error during upload', 0));
      });

      xhr.send(form);
    });
  },

  async adminStats(): Promise<{
    users: { total: number; active: number };
    videos: Record<string, number>;
    jobs: Record<string, number>;
    storage: { totalBytesUsed: number };
  }> {
    const { data } = await request<{
      users: { total: number; active: number };
      videos: Record<string, number>;
      jobs: Record<string, number>;
      storage: { totalBytesUsed: number };
    }>('/admin/stats');
    return data;
  },
};
