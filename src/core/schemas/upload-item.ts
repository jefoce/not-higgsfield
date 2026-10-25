import { z } from 'zod'

/** Media kind shared by uploads and record snapshots. */
export const MediaKindSchema = z.enum(['image', 'video', 'audio'])

export const UploadSourceSchema = z.enum(['file', 'link'])

export const LinkModeSchema = z.enum(['symlink', 'hardlink', 'copy'])
export type LinkMode = z.infer<typeof LinkModeSchema>

const UploadRemoteSchema = z.object({
  key: z.string(),
  sha256: z.string(),
  serverSha256: z.string().nullable(),
  size: z.number(),
  mtimeMs: z.number(),
  uploadedAt: z.string(),
  lastUsedAt: z.string(),
})

/** One upload row stored in `uploads/<uuid>.json`. */
export const UploadItemSchema = z.object({
  id: z.string(),
  source: UploadSourceSchema,
  kind: MediaKindSchema,
  mime: z.string(),
  ext: z.string(),
  originalName: z.string(),
  target: z.string().optional(),
  linkMode: LinkModeSchema.optional(),
  sizeBytes: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
  createdAt: z.string(),
  missing: z.boolean().optional(),
  remote: UploadRemoteSchema.optional(),
})

export type UploadItem = z.infer<typeof UploadItemSchema>
