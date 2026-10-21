import { spawn } from 'node:child_process';
import { boxFor, HLS_SEGMENT_SECONDS, type Rendition } from '@video-streaming/shared';
import { loadConfig } from './config';
import { logger } from './logger';

export type ProbeResult = {
  width: number;
  height: number;
  durationSeconds: number;
  hasAudio: boolean;
};

function run(binary: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      // ffmpeg writes diagnostics to stderr; the tail is the useful part.
      reject(new Error(`${binary} exited with code ${code}: ${stderr.trim().slice(-800)}`));
    });
  });
}

export async function probe(inputPath: string): Promise<ProbeResult> {
  const cfg = loadConfig();

  const raw = await run(cfg.FFPROBE_PATH, [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,width,height:format=duration',
    '-of', 'json',
    inputPath,
  ]);

  const parsed = JSON.parse(raw) as {
    streams?: { codec_type?: string; width?: number; height?: number }[];
    format?: { duration?: string };
  };

  const video = parsed.streams?.find((s) => s.codec_type === 'video');
  if (!video?.width || !video.height) {
    throw new Error('Input has no decodable video stream');
  }

  return {
    width: video.width,
    height: video.height,
    durationSeconds: Math.round(Number(parsed.format?.duration ?? 0)),
    hasAudio: parsed.streams?.some((s) => s.codec_type === 'audio') ?? false,
  };
}

/**
 * Encodes one HLS rendition into `outDir`, producing segment_N.ts files and a
 * master.m3u8 variant playlist (docs/32_FFmpeg_Profiles.md,
 * docs/33_Bucket_Structure.md).
 */
export async function encodeRendition(
  inputPath: string,
  outDir: string,
  rendition: Rendition,
  hasAudio: boolean,
  source: { width: number; height: number },
): Promise<void> {
  const cfg = loadConfig();

  // Transposed for a portrait source, so the rung's number lands on the short
  // side rather than the tall one.
  const box = boxFor(rendition, source.width, source.height);

  const args = [
    '-hide_banner',
    '-y',
    '-i', inputPath,

    // Fit inside the rendition box, preserving aspect ratio and keeping both
    // dimensions even (H.264 requires even dimensions). docs/32 uses a fixed
    // `scale=W:H`, which stretches any source that is not exactly 16:9.
    '-vf', `scale=w=${box.width}:h=${box.height}:force_original_aspect_ratio=decrease:force_divisible_by=2`,

    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', String(rendition.crf),
    '-b:v', `${rendition.videoKbps}k`,
    '-maxrate', `${rendition.videoKbps}k`,
    '-bufsize', `${rendition.videoKbps * 2}k`,
    '-profile:v', rendition.h264Profile,
    '-level', rendition.level,

    // Cap at 30 fps (docs/32_FFmpeg_Profiles.md: "Same as input, max 30 fps").
    '-r', '30',

    // Force a keyframe at every segment boundary. Without this, segments are
    // cut mid-GOP and the renditions are not aligned, so a player switching
    // quality mid-stream stalls or skips.
    '-force_key_frames', `expr:gte(t,n_forced*${HLS_SEGMENT_SECONDS})`,
  ];

  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', `${rendition.audioKbps}k`, '-ac', '2');
  } else {
    args.push('-an');
  }

  args.push(
    '-f', 'hls',
    '-hls_time', String(HLS_SEGMENT_SECONDS),
    // `vod` rather than docs/32's `event`: these assets are complete, and vod
    // tells the player the duration up front so the seek bar works.
    '-hls_playlist_type', 'vod',
    '-hls_segment_filename', `${outDir}/segment_%d.ts`,
    `${outDir}/master.m3u8`,
  );

  logger.debug({ rendition: rendition.name }, 'encoding rendition');
  await run(cfg.FFMPEG_PATH, args);
}

/** Extracts a single JPEG frame at `atSecond`. */
export async function extractThumbnail(
  inputPath: string,
  outPath: string,
  atSecond: number,
  width: number,
): Promise<void> {
  const cfg = loadConfig();

  await run(cfg.FFMPEG_PATH, [
    '-hide_banner',
    '-y',
    // Seeking before -i is the fast path: it jumps rather than decoding from
    // the start of the file.
    '-ss', String(atSecond),
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', `scale=w=${width}:h=-2`,
    '-q:v', '3',
    outPath,
  ]);
}

/** Builds the animated preview GIF (docs/33_Bucket_Structure.md). */
export async function buildPreviewGif(
  inputPath: string,
  outPath: string,
  startSecond: number,
  durationSeconds: number,
): Promise<void> {
  const cfg = loadConfig();

  await run(cfg.FFMPEG_PATH, [
    '-hide_banner',
    '-y',
    '-ss', String(startSecond),
    '-t', String(durationSeconds),
    '-i', inputPath,
    // A generated palette keeps the GIF small without the banding that the
    // default 256-colour quantiser produces.
    '-vf', 'fps=10,scale=w=320:h=-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
    '-loop', '0',
    outPath,
  ]);
}
