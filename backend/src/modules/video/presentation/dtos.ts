import { z } from 'zod';
import { VideoStatus } from '@prisma/client';

export const listVideosSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(VideoStatus).optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export const uploadMetadataSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional(),
  isPublic: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const updateVideoSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2_000).optional(),
    isPublic: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const progressSchema = z.object({
  position: z.number().int().min(0),
  duration: z.number().int().min(0),
});

export type ListVideosQuery = z.infer<typeof listVideosSchema>;
export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;

export const reprocessSchema = z.object({
  /**
   * Produce every rung even where that scales the source up. The extra pixels
   * are interpolated, so this is for exercising the ladder, not for quality.
   */
  allowUpscale: z.boolean().optional().default(false),
});

export type ReprocessInput = z.infer<typeof reprocessSchema>;
