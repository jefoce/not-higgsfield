import { clamp, filter, orderBy } from 'lodash-es'
import { HISTORY_MAX_PAGE_SIZE, HISTORY_PAGE_SIZE } from './constants'
import {
  ACTIVE_STATUSES,
  type GenerationRecord,
  type HistoryFilters,
  type JobStatus,
} from './types'

type StatusFilter = NonNullable<HistoryFilters['status']>

const hasMedia = (input: GenerationRecord['input']): boolean =>
  Boolean(input.frames.start || input.frames.end || input.references.length)

const matchesStatus = (status: JobStatus, wanted: StatusFilter): boolean => {
  if (wanted === 'all') return true
  if (wanted === 'done') return status === 'completed'
  if (wanted === 'active') return ACTIVE_STATUSES.includes(status)
  return status === 'failed' || status === 'cancelled' || status === 'expired'
}

export function applyFilters(
  records: GenerationRecord[],
  filters: HistoryFilters,
): GenerationRecord[] {
  const q = filters.q?.trim().toLowerCase()

  return filter(records, (record) => {
    if (q) {
      const haystack = `${record.input.prompt} ${record.preset.title}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (filters.model && record.input.presetId !== filters.model) return false
    if (filters.favorite != null && record.favorite !== filters.favorite) return false
    if (filters.status && !matchesStatus(record.status, filters.status)) return false
    const mode = filters.mode && filters.mode !== 'all' ? filters.mode : null
    if (mode === 'text' && hasMedia(record.input)) return false
    if (mode === 'frames' && !record.input.frames.start) return false
    if (mode === 'references' && !record.input.references.length) return false
    if (!mode && filters.tab && filters.tab !== 'all' && record.input.tab !== filters.tab) return false
    if (filters.resolution && filters.resolution !== 'all' && record.input.resolution !== filters.resolution) return false
    if (filters.aspect && filters.aspect !== 'all' && record.input.aspectRatio !== filters.aspect) return false
    if (filters.audio && filters.audio !== 'any' && record.input.audio !== (filters.audio === 'on')) return false
    return true
  })
}

export function sortRecords(records: GenerationRecord[]): GenerationRecord[] {
  return orderBy(records, ['createdAt', 'id'], ['desc', 'desc'])
}

function parseCursor(cursor: string): { createdAt: string; id: string } {
  const sep = cursor.lastIndexOf('|')
  if (sep < 0) return { createdAt: cursor, id: '\uffff' }
  return { createdAt: cursor.slice(0, sep), id: cursor.slice(sep + 1) }
}

const isAfter = (record: GenerationRecord, cursor: { createdAt: string; id: string }): boolean =>
  record.createdAt < cursor.createdAt ||
  (record.createdAt === cursor.createdAt && record.id < cursor.id)

interface PaginateParams {
  records: GenerationRecord[]
  cursor: string | null
  limit: number
}

export function paginate(params: PaginateParams): { items: GenerationRecord[]; nextCursor: string | null } {
  const { records, cursor, limit } = params
  const size = clamp(Math.trunc(limit) || HISTORY_PAGE_SIZE, 1, HISTORY_MAX_PAGE_SIZE)
  const at = cursor ? parseCursor(cursor) : null
  const remaining = at ? records.filter((record) => isAfter(record, at)) : records
  const items = remaining.slice(0, size)
  const last = items[items.length - 1]
  const nextCursor = remaining.length > size ? `${last.createdAt}|${last.id}` : null
  return { items, nextCursor }
}

export function countActive(records: GenerationRecord[]): number {
  return filter(records, (record) => ACTIVE_STATUSES.includes(record.status)).length
}
