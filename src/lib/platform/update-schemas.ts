import { z } from 'zod'

import { INSTALL_KINDS, UPDATE_PHASES } from './types'

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
  phase: z.enum(UPDATE_PHASES),
})

export const InstallResultSchema = z.object({
  cancelled: z.boolean(),
})
