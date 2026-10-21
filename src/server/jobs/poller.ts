import 'server-only'
import { MAX_JOB_AGE_MIN, POLL_INTERVAL_MS, POLL_PARALLEL } from '@/core/constants'
import { ACTIVE_STATUSES, type GenerationRecord, type JobStatus } from '@/core/types'
import { globalState } from '../global-state'
import { sweepCompatFiles } from '../media/compat'
import { assertFfmpeg } from '../media/ffmpeg'
import {
  getVideoJob,
  isMockMode,
  OpenRouterError,
  type VideoJobResponse,
} from '../openrouter/client'
import { cleanupStale, ensureDirs } from '../paths'
import { sweepRemote } from '../remote/remote-inputs'
import { getGeneration, listActiveGenerations, saveGeneration } from '../repos/generations'
import { secretsReady } from '../secrets'
import { isDownloadQueued, queueDownload, stopDownloads } from './download-queue'
import { withLock } from './lock'
import { interruptText, needsInterruptFail, reconcile } from './reconcile'

export { needsInterruptFail } from './reconcile'

const SWEEP_INTERVAL_MS = 24 * 60 * 60_000

interface PollerState {
  timer: NodeJS.Timeout | null
  sweepTimer: NodeJS.Timeout | null
  sweepFirst: NodeJS.Timeout | null
  running: boolean
  started: boolean
  booted: boolean
  stopped: boolean
}
const state = globalState<PollerState>('poller', () => ({
  timer: null,
  sweepTimer: null,
  sweepFirst: null,
  running: false,
  started: false,
  booted: false,
  stopped: false,
}))

/** Starts the singleton poller. Safe to call many times. */
export function startPoller(): void {
  if (state.started) return
  state.started = true
  state.stopped = false
  void boot().catch((error) => {
    state.started = false
    console.error('[not-higgsfield] poller boot failed', error)
  })
}

/** True once boot finished: dirs, cleanup, reconcile and grace resume. */
export function isBooted(): boolean {
  return state.booted
}

/** Stops poll, sweep and download intake. Safe to call many times. */
export function stopPoller(): void {
  state.stopped = true
  state.started = false
  state.booted = false
  if (state.timer) clearInterval(state.timer)
  if (state.sweepTimer) clearInterval(state.sweepTimer)
  if (state.sweepFirst) clearTimeout(state.sweepFirst)
  state.timer = null
  state.sweepTimer = null
  state.sweepFirst = null
  stopDownloads()
}

async function boot(): Promise<void> {
  await ensureDirs()
  await cleanupStale()
  assertFfmpeg()
  await reconcile()
  if (state.stopped) return
  state.timer = setInterval(() => void tick(), POLL_INTERVAL_MS)
  state.timer.unref()
  state.booted = true
  void tick()

  state.sweepFirst = setTimeout(() => void sweepUnusedRemote(), 60_000)
  state.sweepFirst.unref()
  state.sweepTimer = setInterval(() => void sweepUnusedRemote(), SWEEP_INTERVAL_MS)
  state.sweepTimer.unref()
}

/** Deletes remote objects unused for REMOTE_UNUSED_DAYS. Failures are logged, not fatal. */
async function sweepUnusedRemote(): Promise<void> {
  try {
    const { deleted, cleared } = await sweepRemote()
    const compat = await sweepCompatFiles()
    if (deleted || cleared || compat) {
      console.log(`[not-higgsfield] remote sweep deleted ${deleted}, cleared ${cleared}, compat ${compat}`)
    }
  } catch (error) {
    console.error('[not-higgsfield] remote sweep failed', error)
  }
}

async function tick(): Promise<void> {
  if (state.running) return
  state.running = true
  try {
    await secretsReady()
    const records = await listActiveGenerations()
    for (let i = 0; i < records.length; i += POLL_PARALLEL) {
      const chunk = records.slice(i, i + POLL_PARALLEL)
      await Promise.all(
        chunk.map((record) =>
          withLock(record.id, () => processById(record.id)).catch((error) =>
            console.error(`[not-higgsfield] poll failed for ${record.id}`, error),
          ),
        ),
      )
    }
  } catch (error) {
    console.error('[not-higgsfield] poll tick failed', error)
  } finally {
    state.running = false
  }
}

/** Re-reads inside the lock so a concurrent favorite update is not overwritten. */
async function processById(id: string): Promise<void> {
  const record = await getGeneration(id)
  if (!record || !ACTIVE_STATUSES.includes(record.status)) return
  if (isDownloadQueued(id)) return

  if (!record.job?.id) {
    if (needsInterruptFail(record)) {
      await saveGeneration({
        ...record,
        status: 'failed',
        error: interruptText(record),
        submit: undefined,
      })
    }
    return
  }

  await processRecord(record)
}

async function processRecord(record: GenerationRecord): Promise<void> {
  const current = record.job
  if (!current?.id) return

  let job: VideoJobResponse
  try {
    job = await getVideoJob(current.id, { submittedAt: current.submittedAt })
  } catch (error) {
    if (await handleJobError(record, error)) return
    throw error
  }

  const status = asJobStatus(job.status) ?? record.status
  if (isAgedOut(record, status)) {
    await saveGeneration({ ...record, status: 'expired', error: 'Job expired' })
    return
  }

  const now = new Date().toISOString()
  const jobFields = {
    ...current,
    generationId: job.generation_id ?? current.generationId,
    expiresAt: job.expires_at ?? current.expiresAt,
    ...(status === 'in_progress' && !current.startedAt ? { startedAt: now } : {}),
  }
  let next: GenerationRecord = {
    ...record,
    status,
    job: jobFields,
    error: status === 'failed' ? record.error : undefined,
  }

  const usageCost = job.usage?.cost
  if (usageCost != null) {
    const actual = isMockMode() ? record.cost.estimatedUsd : usageCost
    next = {
      ...next,
      cost: { ...next.cost, actualUsd: actual, isByok: job.usage?.is_byok ?? null, billed: actual > 0 },
    }
  }

  if (!FINAL.includes(status)) {
    await saveGeneration(next)
    return
  }

  next = { ...next, job: { ...next.job!, completedAt: next.job?.completedAt ?? now } }
  if (status === 'completed') {
    await queueDownload(next, job)
    return
  }

  if (usageCost == null) next = { ...next, cost: { ...next.cost, actualUsd: 0, billed: false } }
  const fallback = status === 'expired' ? 'Job expired' : `Job ${status}`
  await saveGeneration({ ...next, error: job.error ?? fallback })
}

/** Returns true when the error was handled and this tick should stop. */
async function handleJobError(record: GenerationRecord, error: unknown): Promise<boolean> {
  if (!(error instanceof OpenRouterError)) return false

  if (error.status === 404) {
    await saveGeneration({ ...record, status: 'failed', error: 'Job not found on OpenRouter' })
    return true
  }

  if (error.status === 401 || error.status === 403) {
    const text = `OpenRouter auth failed: ${error.message}`
    if (record.error !== text) await saveGeneration({ ...record, error: text })
    return true
  }

  return error.status === 0 || error.status === 429 || error.status >= 500
}

function isAgedOut(record: GenerationRecord, status: JobStatus): boolean {
  if (status !== 'pending' && status !== 'in_progress') return false
  return Date.now() - Date.parse(record.createdAt) > MAX_JOB_AGE_MIN * 60_000
}

const STATUSES: JobStatus[] = [...ACTIVE_STATUSES, 'completed', 'failed', 'cancelled', 'expired']
const FINAL: JobStatus[] = ['completed', 'failed', 'cancelled', 'expired']

function asJobStatus(value: string): JobStatus | null {
  return STATUSES.includes(value as JobStatus) ? (value as JobStatus) : null
}
