import type { Rendition } from '@video-streaming/shared';

const PROFILE_IDC: Record<Rendition['h264Profile'], number> = {
  baseline: 0x42,
  main: 0x4d,
  high: 0x64,
};

/**
 * RFC 6381 codec string for a rendition, e.g. `avc1.4d0028`.
 *
 * Derived from the profile and level actually passed to the encoder rather
 * than a lookup table, so the two cannot disagree. Players use this to decide
 * whether a variant is playable before fetching any of it.
 */
export function avcCodecString(rendition: Rendition): string {
  const profile = PROFILE_IDC[rendition.h264Profile].toString(16);
  const level = Math.round(Number.parseFloat(rendition.level) * 10)
    .toString(16)
    .padStart(2, '0');
  return `avc1.${profile}00${level}`;
}

export type VariantInfo = {
  rendition: Rendition;
  /** Actual encoded dimensions, which may differ from the ladder box. */
  width: number;
  height: number;
};

/**
 * Multi-variant (master) playlist referencing each rendition's own playlist.
 * This is the URL the player loads; it is what makes the stream adaptive.
 */
export function buildMasterPlaylist(variants: VariantInfo[], hasAudio: boolean): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3', ''];

  // Ascending bandwidth: players pick the first playable variant on startup,
  // so leading with the smallest avoids a stall on a slow connection.
  const ordered = [...variants].sort(
    (a, b) => a.rendition.videoKbps - b.rendition.videoKbps,
  );

  for (const variant of ordered) {
    const { rendition } = variant;
    const bandwidth = (rendition.videoKbps + (hasAudio ? rendition.audioKbps : 0)) * 1000;
    const codecs = hasAudio
      ? `${avcCodecString(rendition)},mp4a.40.2`
      : avcCodecString(rendition);

    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${variant.width}x${variant.height},CODECS="${codecs}"`,
      `${rendition.name}/master.m3u8`,
    );
  }

  return `${lines.join('\n')}\n`;
}
