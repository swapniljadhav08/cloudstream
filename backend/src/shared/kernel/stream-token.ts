import { createHmac, timingSafeEqual } from 'node:crypto';

// Short-lived capability token for private HLS playback.
//
// The token is carried as a *path segment*, not a query parameter, because an
// HLS master playlist references its variants relatively and each variant
// references its segments relatively. A path segment survives that relative
// resolution, so one token authorises the whole tree:
//
//   /videos/{id}/hls/{token}/master.m3u8
//   /videos/{id}/hls/{token}/720p/master.m3u8   <- resolved relatively
//   /videos/{id}/hls/{token}/720p/segment_0.ts  <- resolved relatively
//
// A query parameter would be dropped by that resolution, and a cookie would
// need a cookie plugin and careful path scoping to achieve the same thing.

export type StreamTokenPayload = {
  videoId: string;
  userId: string;
};

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function issueStreamToken(
  payload: StreamTokenPayload,
  secret: string,
  ttlSeconds: number,
  bucketSeconds = 0,
): string {
  const now = Math.floor(Date.now() / 1000);
  const exact = now + ttlSeconds;

  // With a bucket, expiry rounds UP to the next boundary, so every token
  // issued inside one window is byte-for-byte identical.
  //
  // This matters because the token is part of the playback URL, and a player
  // treats a changed URL as a different stream. An expiry to the exact second
  // made every fetch of the same video yield a new URL, so a page that polls
  // the record (as the player page does while a video encodes) kept handing
  // the player a "new" source and restarting playback. Rounding up never
  // shortens the lifetime: validity is between ttl and ttl + bucket.
  const expiresAt = bucketSeconds > 0 ? Math.ceil(exact / bucketSeconds) * bucketSeconds : exact;
  const data = `${payload.videoId}.${payload.userId}.${expiresAt}`;
  return `${Buffer.from(data).toString('base64url')}.${sign(data, secret)}`;
}

export function verifyStreamToken(
  token: string,
  videoId: string,
  secret: string,
): StreamTokenPayload | null {
  const separator = token.lastIndexOf('.');
  if (separator === -1) return null;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const data = Buffer.from(encoded, 'base64url').toString('utf8');
  const expected = sign(data, secret);

  // Constant-time comparison: a length-dependent or short-circuiting compare
  // leaks how much of a forged signature was correct.
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return null;
  }

  const [tokenVideoId, userId, expiresAt] = data.split('.');
  if (tokenVideoId !== videoId) return null;
  if (Number(expiresAt) < Math.floor(Date.now() / 1000)) return null;

  return { videoId: tokenVideoId, userId };
}

const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.json': 'application/json',
};

export function mediaContentType(path: string): string {
  const dot = path.lastIndexOf('.');
  return (dot === -1 ? undefined : CONTENT_TYPES[path.slice(dot)]) ?? 'application/octet-stream';
}
