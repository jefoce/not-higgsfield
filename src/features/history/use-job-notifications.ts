'use client'

import { createElement, useEffect, useRef } from 'react'
import { countBy } from 'lodash-es'
import { toast } from 'sonner'
import { z } from 'zod'
import { HISTORY_SCROLL_DELAY_MS } from '@/core/constants'
import type { GenerationRecord, JobStatus } from '@/core/types'
import { truncate } from '@/lib/format'
import { readLocal, writeLocal } from '@/lib/local-store'
import { getPlatform } from '@/lib/platform'
import { plainPrompt, posterSrc } from './record-view'
import { useHistoryViewStore } from './view-store'

interface JobNotificationParams {
  records: GenerationRecord[]
  activeCount: number
  isLoading: boolean
}

const LAST_SEEN_KEY = 'not-higgsfield:lastSeenAt'
const LAST_SEEN_VALUE = z.string()
const SUMMARY_STATUSES: JobStatus[] = ['completed', 'expired', 'failed']

const FAILED_TITLES: Partial<Record<JobStatus, string>> = {
  failed: 'Generation failed',
  cancelled: 'Generation cancelled',
  expired: 'Generation expired',
}

function scrollToRecord(id: string): void {
  document
    .getElementById(`history-item-${id}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function readLastSeen(): number | null {
  const value = readLocal(LAST_SEEN_KEY, LAST_SEEN_VALUE).value
  if (!value) return null
  const at = Date.parse(value)
  return Number.isFinite(at) ? at : null
}

function summaryText(records: GenerationRecord[]): string {
  const counts = countBy(records, 'status')
  const videos = (count: number) => `${count} ${count === 1 ? 'video' : 'videos'}`
  const parts: string[] = []
  if (counts.completed) {
    parts.push(
      `${videos(counts.completed)} finished while the app was closed and ${
        counts.completed === 1 ? 'is' : 'are'
      } downloading.`,
    )
  }
  if (counts.expired) {
    parts.push(
      `${videos(counts.expired)} expired before ${
        counts.expired === 1 ? 'it' : 'they'
      } could be downloaded.`,
    )
  }
  if (counts.failed) parts.push(`${videos(counts.failed)} failed while the app was closed.`)
  return parts.join(' ')
}

/** Scrolls to history and applies its status bucket; ids are not a server filter. */
function showChanges(records: GenerationRecord[]): void {
  const store = useHistoryViewStore.getState()
  store.resetFilters()
  const buckets = new Set(records.map((record) => (record.status === 'completed' ? 'done' : 'failed')))
  if (buckets.size === 1) store.setFilters({ status: buckets.values().next().value })
  document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const first = records[0]
  if (first) window.setTimeout(() => scrollToRecord(first.id), HISTORY_SCROLL_DELAY_MS)
}

function notifyHidden(title: string, body: string): void {
  if (document.visibilityState !== 'hidden') return
  void getPlatform()
    .then((platform) => platform.notify(title, body))
    .catch(() => undefined)
}

/** Toasts for status transitions, hidden-tab notifications and the tab title. */
export function useJobNotifications(params: JobNotificationParams): void {
  const { records, activeCount, isLoading } = params
  const previous = useRef<Map<string, JobStatus> | null>(null)
  const baseTitle = useRef<string | null>(null)
  const summaryChecked = useRef(false)

  useEffect(() => {
    baseTitle.current ??= document.title
    const title = baseTitle.current
    return () => {
      if (title) document.title = title
    }
  }, [])

  useEffect(() => {
    document.title = activeCount > 0 ? `(${activeCount}) Generating \u00b7 Not Higgsfield` : 'Not Higgsfield'
  }, [activeCount])

  useEffect(() => {
    if (summaryChecked.current || isLoading) return
    summaryChecked.current = true
    const lastSeen = readLastSeen()
    writeLocal(LAST_SEEN_KEY, new Date().toISOString())
    if (lastSeen == null) return
    const changes = records.filter(
      (record) =>
        SUMMARY_STATUSES.includes(record.status) && Date.parse(record.updatedAt) > lastSeen,
    )
    if (!changes.length) return
    toast(summaryText(changes), {
      duration: 10_000,
      action: { label: 'Show', onClick: () => showChanges(changes) },
    })
  }, [isLoading, records])

  useEffect(() => {
    const before = previous.current
    previous.current = new Map(records.map((record) => [record.id, record.status]))
    if (!before) return

    for (const record of records) {
      const previousStatus = before.get(record.id)
      if (!previousStatus || previousStatus === record.status) continue
      const body = truncate(plainPrompt(record), 80)

      if (record.status === 'completed') {
        const poster = posterSrc(record)
        toast.success('Video ready', {
          description: poster
            ? createElement('img', {
                src: poster,
                alt: '',
                className: 'h-16 w-full rounded-lg bg-black object-contain',
              })
            : body,
          action: { label: 'Show', onClick: () => scrollToRecord(record.id) },
        })
        notifyHidden('Video ready', body)
      }

      if (FAILED_TITLES[record.status]) {
        toast.error(FAILED_TITLES[record.status], { description: record.error ?? body })
      }
    }
  }, [records])
}
