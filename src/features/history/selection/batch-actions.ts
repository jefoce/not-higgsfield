import { chunk } from 'lodash-es'

import { HISTORY_BATCH_MAX } from '@/core/constants'
import { batchGenerations, type BatchResult } from '@/lib/api/generations'

/** Runs the same batch action in chunks the server accepts. */
export async function batchAction(
  ids: string[],
  body: Record<string, unknown>,
): Promise<BatchResult> {
  const results = await Promise.all(
    chunk(ids, HISTORY_BATCH_MAX).map((part) => batchGenerations(part, body)),
  )

  return {
    done: results.flatMap((result) => result.done),
    skipped: results.flatMap((result) => result.skipped),
  }
}
