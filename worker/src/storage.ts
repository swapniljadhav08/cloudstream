import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadConfig } from './config';

const cfg = loadConfig();

export const s3 = new S3Client({
  region: cfg.S3_REGION,
  endpoint: cfg.S3_ENDPOINT,
  forcePathStyle: cfg.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: cfg.S3_ACCESS_KEY,
    secretAccessKey: cfg.S3_SECRET_KEY,
  },
});

export async function downloadToFile(key: string, destPath: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: cfg.S3_BUCKET, Key: key }));
  if (!res.Body) {
    throw new Error(`Object not found: ${key}`);
  }
  await pipeline(res.Body as Readable, createWriteStream(destPath));
}

export async function uploadFile(
  key: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  // Content length is passed explicitly: a plain stream without it makes the
  // SDK buffer the whole body to work the length out.
  const { size } = await stat(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.S3_BUCKET,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: size,
      ContentType: contentType,
      // Segments and playlists are immutable once written: the key changes if
      // the content does, so they can be cached hard (docs/18_Caching.md).
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

export async function uploadText(
  key: string,
  body: string,
  contentType: string,
  cacheControl = 'public, max-age=300',
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

const CONTENT_TYPES: Record<string, string> = {
  '.ts': 'video/mp2t',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.json': 'application/json',
};

export function contentTypeFor(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return (dot === -1 ? undefined : CONTENT_TYPES[filename.slice(dot)]) ?? 'application/octet-stream';
}

/** Uploads every file in `dir` under `keyPrefix`, concurrently but bounded. */
export async function uploadDirectory(dir: string, keyPrefix: string): Promise<number> {
  const names = await readdir(dir);
  const limit = 6;
  let uploaded = 0;

  for (let i = 0; i < names.length; i += limit) {
    const batch = names.slice(i, i + limit);
    await Promise.all(
      batch.map((name) =>
        uploadFile(`${keyPrefix}${name}`, join(dir, name), contentTypeFor(name)),
      ),
    );
    uploaded += batch.length;
  }

  return uploaded;
}
