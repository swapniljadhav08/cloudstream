// Object key layout from docs/33_Bucket_Structure.md.
//
// Backend and worker both derive keys here. If these drift, the worker writes
// media the player cannot find, so the layout lives in exactly one place.
//
//   {videoId}/original.mp4
//   {videoId}/metadata.json
//   {videoId}/thumbnails/{timestamp}s.jpg
//   {videoId}/preview.gif
//   {videoId}/hls/{resolution}/master.m3u8
//   {videoId}/hls/{resolution}/segment_{index}.ts
//   {videoId}/hls/master.m3u8            <- multi-variant playlist
//   temp/{videoId}/...                   <- lifecycle: expires after 1 day

export const storageKeys = {
  original: (videoId: string): string => `${videoId}/original.mp4`,
  metadata: (videoId: string): string => `${videoId}/metadata.json`,
  thumbnail: (videoId: string, seconds: number): string =>
    `${videoId}/thumbnails/${seconds}s.jpg`,
  preview: (videoId: string): string => `${videoId}/preview.gif`,
  hlsVariantPlaylist: (videoId: string, resolution: string): string =>
    `${videoId}/hls/${resolution}/master.m3u8`,
  hlsSegment: (videoId: string, resolution: string, index: number): string =>
    `${videoId}/hls/${resolution}/segment_${index}.ts`,
  hlsMasterPlaylist: (videoId: string): string => `${videoId}/hls/master.m3u8`,
  hlsPrefix: (videoId: string, resolution: string): string =>
    `${videoId}/hls/${resolution}/`,
  temp: (videoId: string, name: string): string => `temp/${videoId}/${name}`,
} as const;

/**
 * Normalises the sub-path of a private playback request into a storage key
 * fragment under `{videoId}/hls/`.
 *
 * Kept beside the key builders so the proxy route and the worker's output
 * layout cannot drift apart.
 */
export function hlsSubPath(path: string): string {
  return `hls/${path.replace(/^\/+/, '')}`;
}
