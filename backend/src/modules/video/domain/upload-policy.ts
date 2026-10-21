import { AppError } from '../../../shared/kernel/errors';

// Upload policy from docs/31_File_Upload_Policy.md.

export const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/x-flv',
] as const;

export const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'] as const;

/** 5 GB per single upload (docs/31_File_Upload_Policy.md). */
export const MAX_FILE_SIZE_BYTES = 5_368_709_120;

export function assertAllowedMimeType(mimeType: string): void {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      `Unsupported media type "${mimeType}"`,
      { allowed: ALLOWED_MIME_TYPES },
    );
  }
}

export function assertAllowedExtension(filename: string): void {
  const dot = filename.lastIndexOf('.');
  const ext = dot === -1 ? '' : filename.slice(dot).toLowerCase();

  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      `Unsupported file extension "${ext || '(none)'}"`,
      { allowed: ALLOWED_EXTENSIONS },
    );
  }
}

// Container signatures. A client-supplied MIME type and extension are both
// trivially forged, so the declared type is cross-checked against the bytes.
//
// ponytail: signature prefixes only, which is enough to reject a renamed
// non-video. Swap in full container probing (ffprobe in the worker already
// does this) if a stricter gate is ever needed.
const SIGNATURES: ReadonlyArray<{ offset: number; bytes: readonly number[] }> = [
  { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // MP4 / MOV: 'ftyp' box
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // AVI: 'RIFF'
  { offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }, // MKV / WebM: EBML
  { offset: 0, bytes: [0x46, 0x4c, 0x56, 0x01] }, // FLV
];

export function looksLikeVideo(head: Buffer): boolean {
  return SIGNATURES.some(
    (sig) =>
      head.length >= sig.offset + sig.bytes.length &&
      sig.bytes.every((b, i) => head[sig.offset + i] === b),
  );
}

export function assertLooksLikeVideo(head: Buffer): void {
  if (!looksLikeVideo(head)) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      'File content does not match a supported video container',
    );
  }
}
