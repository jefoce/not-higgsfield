import { z } from 'zod'

import type { InstallKind } from './types'

const INSTALL_KINDS = [
  'macos',
  'windows',
  'appimage',
  'linux-package',
  'browser',
] as const satisfies readonly InstallKind[]

const InstallKindSchema = z.enum(INSTALL_KINDS)

export const AppInfoSchema = z.object({
  version: z.string(),
  installKind: InstallKindSchema,
  autoCheck: z.boolean(),
  lastCheck: z.string().nullable(),
})

export const AppUpdateSchema = z.object({
  version: z.string(),
  notes: z.string(),
  date: z.string().nullable(),
})

export const UpdateCheckSchema = AppUpdateSchema.nullable()

export const UpdateProgressSchema = z.object({
  downloaded: z.number(),
  total: z.number().nullable(),
  phase: z.enum(['downloading', 'installing']),
})

export const InstallResultSchema = z.object({
  cancelled: z.boolean(),
})
