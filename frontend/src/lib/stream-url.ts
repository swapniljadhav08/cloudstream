/**
 * The identity of a stream, independent of the credential used to reach it.
 *
 * A private video's playback URL embeds a signed token as a path segment:
 *
 *   .../videos/{id}/hls/{token}/master.m3u8
 *
 * The token is refreshed whenever the record is fetched, but the stream it
 * unlocks is the same one. A player that treats every new URL as a new source
 * restarts playback each time, so callers compare identities and only reload
 * when the stream really changed. Public URLs carry no token and pass through.
 */
export function streamIdentity(url: string): string {
  return url.replace(/\/hls\/[^/]+\/(?=master\.m3u8$)/, '/hls/');
}
