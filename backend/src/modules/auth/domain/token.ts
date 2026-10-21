import { createHash, randomBytes } from 'node:crypto';

// Refresh tokens are opaque, not JWTs: they must be revocable, which means a
// server-side record. Only the hash is stored, so a database leak does not
// hand out usable tokens.

export type RefreshTokenPair = {
  /** Sent to the client. Never persisted. */
  raw: string;
  /** Persisted in refresh_tokens.token. */
  hash: string;
};

export function issueRefreshToken(): RefreshTokenPair {
  const raw = `rt_${randomBytes(32).toString('hex')}`;
  return { raw, hash: hashRefreshToken(raw) };
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
