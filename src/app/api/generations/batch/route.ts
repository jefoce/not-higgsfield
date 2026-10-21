import { z } from 'zod'
import { HISTORY_BATCH_MAX } from '@/core/constants'
import type { BatchSkip } from '@/core/types'
import {
  assertLocalRequest,
  errorResponse,
  jsonError,
  readJsonBody,
  zodError,
} from '@/server/http'
import { deleteGeneration, setFavorite } from '@/server/jobs/generation-actions'

const BodySchema = z.object({
  action: z.enum(['favorite', 'delete']),
  ids: z.array(z.string().uuid()).min(1).max(HISTORY_BATCH_MAX),
  favorite: z.boolean().optional(),
})

type SkipReason = BatchSkip['reason']

/** Sequential per-record batch actions; each record runs under its own lock. */
export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return zodError(body.error)

    const { action, ids, favorite } = body.data
    if (action === 'favorite' && favorite === undefined) {
      return jsonError({ status: 400, error: 'favorite is required for the favorite action' })
    }

    const done: string[] = []
    const skipped: BatchSkip[] = []

    for (const id of ids) {
      const reason =
        action === 'favorite' ? await favoriteOne(id, favorite === true) : await deleteOne(id)
      if (reason) skipped.push({ id, reason })
      else done.push(id)
    }

    return Response.json({ done, skipped })
  } catch (error) {
    return errorResponse(error)
  }
}

async function favoriteOne(id: string, favorite: boolean): Promise<SkipReason | null> {
  const saved = await setFavorite(id, favorite)
  return saved ? null : 'not_found'
}

async function deleteOne(id: string): Promise<SkipReason | null> {
  const result = await deleteGeneration(id)
  if (result === 'deleted') return null
  if (result === 'not_found') return 'not_found'
  return 'active'
}
