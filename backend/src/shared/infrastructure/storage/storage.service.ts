import { Injectable, OnModuleInit } from '@nestjs/common';
import { Readable } from 'node:stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { isDeliveredMedia } from '@video-streaming/shared';
import { loadConfig } from '../../../config';
import { AppError } from '../../kernel/errors';
import { logger } from '../logger/logger';

// S3-compatible object storage.
//
// The AWS SDK is used so the same code runs against LocalStack, AWS S3,
// Cloudflare R2 and OCI Object Storage (S3 compatibility mode). Only the
// endpoint changes, and it comes from Terraform outputs. See also
// docs/26_Environment_Variables.md defines the storage contract.
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly mediaBucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const cfg = loadConfig();
    this.bucket = cfg.S3_BUCKET;
    this.mediaBucket = cfg.S3_BUCKET_MEDIA ?? cfg.S3_BUCKET;
    this.publicBaseUrl = cfg.NEXT_PUBLIC_MEDIA_BASE_URL.replace(/\/+$/, '');

    this.client = new S3Client({
      region: cfg.S3_REGION,
      endpoint: cfg.S3_ENDPOINT,
      // Path-style addressing: virtual-host style needs per-bucket DNS, which
      // neither LocalStack nor a self-hosted gateway provides. Harmless on
      // real S3, which still accepts path-style requests.
      forcePathStyle: cfg.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: cfg.S3_ACCESS_KEY,
        secretAccessKey: cfg.S3_SECRET_KEY,
      },
    });
  }

  // Buckets are provisioned by Terraform, never by the application. Failing
  // fast here turns a missing bucket into one clear startup error instead of
  // a confusing failure on the first upload.
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      logger.info({ bucket: this.bucket }, 'object storage reachable');
    } catch (err) {
      throw new Error(
        `Bucket "${this.bucket}" is not reachable. Provision it with:\n` +
          `  cd infrastructure/terraform/environments/local && terraform apply\n` +
          `Cause: ${(err as Error).message}`,
      );
    }
  }

  /** The bucket holding a given key. Identical unless storage is split. */
  private bucketFor(key: string): string {
    return isDeliveredMedia(key) ? this.mediaBucket : this.bucket;
  }

  async putObject(key: string, body: Buffer | Readable, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketFor(key),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /**
   * Streams an object of unknown length.
   *
   * PutObject needs the content length up front; lib-storage's Upload splits
   * the stream into multipart parts instead, so a 5 GB upload never has to be
   * buffered in memory to be measured.
   */
  async putStream(key: string, body: Readable, contentType: string): Promise<number> {
    let bytes = 0;
    body.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
    });

    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucketFor(key), Key: key, Body: body, ContentType: contentType },
      queueSize: 4,
      partSize: 16 * 1024 * 1024,
    });

    await upload.done();
    return bytes;
  }

  async getObjectStream(key: string): Promise<Readable> {
    let res;
    try {
      res = await this.client.send(new GetObjectCommand({ Bucket: this.bucketFor(key), Key: key }));
    } catch (err) {
      // A caller asking for a segment that does not exist -- a playlist read
      // mid-transcode, say -- is a 404, not a server fault.
      const name = (err as { name?: string }).name;
      if (name === 'NoSuchKey' || name === 'NotFound') {
        throw new AppError('NOT_FOUND', `Object not found: ${key}`);
      }
      throw err;
    }

    if (!res.Body) {
      throw new AppError('NOT_FOUND', `Object not found: ${key}`);
    }
    return res.Body as Readable;
  }

  async presignedGetUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucketFor(key), Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  /**
   * Deletes every object under a prefix, across both buckets.
   *
   * A video's bytes are split between the private and media buckets, so a
   * delete that swept only one would leave the other half orphaned and still
   * billed. Where the two names are equal the second pass is skipped.
   */
  async deletePrefix(prefix: string): Promise<number> {
    const buckets = this.mediaBucket === this.bucket ? [this.bucket] : [this.bucket, this.mediaBucket];
    let deleted = 0;
    for (const bucket of buckets) {
      deleted += await this.deletePrefixFrom(bucket, prefix);
    }
    return deleted;
  }

  private async deletePrefixFrom(bucket: string, prefix: string): Promise<number> {
    let deleted = 0;
    let continuationToken: string | undefined;

    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const keys = (listed.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => typeof k === 'string');

      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        );
        deleted += keys.length;
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);

    return deleted;
  }

  /** Public URL for delivered media. Terraform grants anonymous GET on these prefixes. */
  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
