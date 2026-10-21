// ABR ladder from docs/32_FFmpeg_Profiles.md.
//
// Mirrors `rendition_ladder` in infrastructure/terraform/modules/platform-contract,
// which exports the same table so infrastructure sizing and encode settings
// cannot disagree. Keep the two in step when changing the ladder.

export type Rendition = {
  name: string;
  width: number;
  height: number;
  /** Target video bitrate in kbps. */
  videoKbps: number;
  /** Target audio bitrate in kbps. */
  audioKbps: number;
  crf: number;
  h264Profile: 'baseline' | 'main' | 'high';
  level: string;
};

export const RENDITION_LADDER: readonly Rendition[] = [
  // 144p is an addition to the 240p-4K ladder in docs/32_FFmpeg_Profiles.md,
  // for very constrained connections.
  { name: '144p', width: 256, height: 144, videoKbps: 150, audioKbps: 48, crf: 30, h264Profile: 'baseline', level: '3.0' },
  { name: '240p', width: 426, height: 240, videoKbps: 400, audioKbps: 64, crf: 28, h264Profile: 'baseline', level: '3.0' },
  { name: '360p', width: 640, height: 360, videoKbps: 800, audioKbps: 96, crf: 26, h264Profile: 'main', level: '3.0' },
  { name: '480p', width: 854, height: 480, videoKbps: 1400, audioKbps: 128, crf: 24, h264Profile: 'main', level: '3.1' },
  { name: '720p', width: 1280, height: 720, videoKbps: 2400, audioKbps: 192, crf: 23, h264Profile: 'main', level: '4.0' },
  { name: '1080p', width: 1920, height: 1080, videoKbps: 4800, audioKbps: 256, crf: 22, h264Profile: 'high', level: '4.2' },
  { name: '4k', width: 3840, height: 2160, videoKbps: 16000, audioKbps: 320, crf: 21, h264Profile: 'high', level: '5.1' },
] as const;

/** HLS target segment duration in seconds (docs/32_FFmpeg_Profiles.md). */
export const HLS_SEGMENT_SECONDS = 10;

/** True when the source is taller than it is wide (vertical / "shorts"). */
export function isPortrait(width: number, height: number): boolean {
  return height > width;
}

/**
 * The encode box for a rung, oriented to match the source.
 *
 * A rung's name is its *shorter* side, which is the usual convention: a
 * 1080x1920 vertical video is "1080p", not "1920p". So for a portrait source
 * the box is transposed, otherwise fitting 720x1280 into a 1280x720 box would
 * yield 406x720 -- a short side of 406 under a label claiming 720.
 */
export function boxFor(
  rendition: Rendition,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  return isPortrait(sourceWidth, sourceHeight)
    ? { width: rendition.height, height: rendition.width }
    : { width: rendition.width, height: rendition.height };
}

/**
 * Renditions worth producing for a source of the given dimensions.
 *
 * Capped by the source's shorter side, for the same reason `boxFor` transposes:
 * the rung name refers to the short side, so a 720x1280 portrait clip tops out
 * at 720p. Upscaling only costs encode time and bandwidth, so rungs above the
 * source are dropped. A source below the lowest rung still yields that rung,
 * so every video gets at least one playable rendition.
 */
export function ladderForSource(
  sourceWidth: number,
  sourceHeight: number,
  options: { allowUpscale?: boolean } = {},
): readonly Rendition[] {
  // Upscaling produces a larger file with no additional detail: the extra
  // pixels are interpolated, not captured. It is offered only so the higher
  // rungs can be exercised deliberately (testing the ABR ladder or the
  // player's quality menu against a low-resolution source).
  if (options.allowUpscale) {
    return RENDITION_LADDER;
  }

  const shortSide = Math.min(sourceWidth, sourceHeight);
  const fitting = RENDITION_LADDER.filter((r) => r.height <= shortSide);
  return fitting.length > 0 ? fitting : [RENDITION_LADDER[0]];
}

/** True when this rung would scale the source up rather than down. */
export function isUpscale(
  rendition: Rendition,
  sourceWidth: number,
  sourceHeight: number,
): boolean {
  return rendition.height > Math.min(sourceWidth, sourceHeight);
}
