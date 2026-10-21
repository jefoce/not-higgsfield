import 'server-only'
import { SUBMIT_YIELD_MS } from '@/core/constants'
import { graceDelayMs } from '@/core/submit-state'
import { globalState } from '../global-state'
import { getGeneration, listGenerations } from '../repos/generations'
import { runSubmit } from './run-submit'

const MAX_CONCURRENT = 2

export type SubmitStage = 'uploading' | 'sending'

interface SubmitState {
  pending: Set<string>
  active: Set<string>
  timers: Map<string, NodeJS.Timeout>
  stages: Map<string, SubmitStage>
  controllers: Map<string, AbortController>
  closed: boolean
}
const state = globalState<SubmitState>('submitQueue', () => ({
  pending: new Set(),
  active: new Set(),
  timers: new Map(),
  stages: new Map(),
  controllers: new Map(),
  closed: false,
}))

/** True while this process owns the submit: timer, queued or running. */
export function isSubmitOwned(id: string): boolean {
  return state.timers.has(id) || state.pending.has(id) || state.active.has(id)
}

/** Running submits. Shutdown waits for these; queued ones resume next boot. */
export function activeSubmitCount(): number {
  return state.active.size
}

/** Runs that already handed the request to OpenRouter but await its reply. */
export function sendingCount(): number {
  let count = 0
  for (const stage of state.stages.values()) if (stage === 'sending') count += 1
  return count
}

/** run-submit marks each phase so shutdown can tell uploads from sends. */
export function setSubmitStage(id: string, stage: SubmitStage | null): void {
  if (stage) state.stages.set(id, stage)
  else state.stages.delete(id)
}

/** True after shutdown stopped the queue. No new submit may start. */
export function isSubmitStopped(): boolean {
  return state.closed
}

/** Schedules an upload and submit after the grace window. */
export async function startSubmit(id: string): Promise<void> {
  if (state.closed || isSubmitOwned(id)) return
  const record = await getGeneration(id)
  if (!record || record.status !== 'submitting' || record.submit?.stage !== 'grace') return
  schedule(id, graceDelayMs(record.submit.notBefore))
}

/** Reschedules the remaining grace windows after a process restart. */
export async function resumeGraceSubmits(): Promise<void> {
  for (const record of await listGenerations()) {
    if (record.status === 'submitting' && record.submit?.stage === 'grace') await startSubmit(record.id)
  }
}

/** Clears a scheduled grace timer so a canceled record never submits. */
export function cancelScheduledSubmit(id: string): void {
  const timer = state.timers.get(id)
  if (timer) {
    clearTimeout(timer)
    state.timers.delete(id)
  }
  state.pending.delete(id)
}

/** Closes the queue, clears grace timers and aborts uploads. Sends finish. */
export function stopSubmits(): void {
  state.closed = true
  for (const timer of state.timers.values()) clearTimeout(timer)
  state.timers.clear()
  state.pending.clear()
  for (const [id, controller] of state.controllers) {
    if (state.stages.get(id) !== 'sending') controller.abort()
  }
}

/** Waits until no run is inside submitVideo, or the timeout expires. */
export async function waitForSendingDone(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (sendingCount() > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, SUBMIT_YIELD_MS))
  }
  return sendingCount() === 0
}

function schedule(id: string, delayMs: number): void {
  if (state.closed || isSubmitOwned(id)) return
  const timer = setTimeout(() => {
    state.timers.delete(id)
    state.pending.add(id)
    drain()
  }, delayMs)
  state.timers.set(id, timer)
}

function drain(): void {
  while (!state.closed && state.active.size < MAX_CONCURRENT && state.pending.size) {
    const id = state.pending.values().next().value
    if (!id) return
    state.pending.delete(id)
    state.active.add(id)
    const controller = new AbortController()
    state.controllers.set(id, controller)
    void runSubmit(id, controller.signal)
      .catch((error) => console.error(`[not-higgsfield] submit failed for ${id}`, error))
      .finally(() => {
        state.active.delete(id)
        state.stages.delete(id)
        state.controllers.delete(id)
        drain()
      })
  }
}
