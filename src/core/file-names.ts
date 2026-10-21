import type { GenerationRecord } from './types'

/** File-safe name from the prompt, falling back to the preset. */
export function promptSlug(record: Pick<GenerationRecord, 'input' | 'preset'>): string {
  const base = record.input.prompt.trim() || record.preset.slug
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'video'
}

/** Batch export name: prompt slug plus 6 id characters. */
export function exportName(record: GenerationRecord): string {
  return `${promptSlug(record)}-${record.id.slice(0, 6)}`
}
