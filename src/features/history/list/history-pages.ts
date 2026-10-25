import { uniqBy } from 'lodash-es'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { GenerationListResult } from '@/core/types'
import { refreshHistory } from '@/lib/swr-keys'

/** Deduped records from every loaded history page. */
export const loadedRecords = (pages?: GenerationListResult[]): GenerationRecord[] =>
  uniqBy(pages?.flatMap((page) => page.items) ?? [], 'id')

interface PatchPageParams {
  page: GenerationListResult
  byId: Map<string, GenerationRecord>
  activeCount: number
}

/** Replaces matching records in one page, keeping order, cursors and the polled count. */
export function patchPage(params: PatchPageParams): GenerationListResult {
  const { page, byId, activeCount } = params
  const hasMatch = page.items.some((item) => byId.has(item.id))

  if (!hasMatch && page.activeCount === activeCount) {
    return page
  }

  let items = page.items

  if (hasMatch) {
    items = page.items.map((item) => byId.get(item.id) ?? item)
  }

  return {
    ...page,
    activeCount,
    items,
  }
}

/** Revalidates every loaded history page. */
export function revalidateHistory(): Promise<unknown> {
  return refreshHistory()
}
