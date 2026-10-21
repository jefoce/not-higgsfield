import 'server-only'
import { globalState } from '../global-state'
import { withLock } from '../jobs/lock'
import { HttpError } from '../request-guard'
import { bridgeBackend, KeychainUnavailableError } from './bridge'
import { fileBackend } from './file'
import { keychainBackend } from './keychain'
import { sessionRequired } from '../session'
import { R2_NAMES, SECRET_NAMES, type SecretName } from '@/core/secret-names'
import type { SecretSource, SecretStatus } from '@/core/types'

export interface SecretBackend {
  kind: Exclude<SecretSource, 'env'>
  getAll(): Promise<Partial<Record<SecretName, string>>>
  get(name: SecretName): Promise<string | null>
  set(name: SecretName, value: string): Promise<void>
  remove(name: SecretName): Promise<void>
}

interface Entry {
  value: string
  source: SecretSource
}

interface SecretsState {
  loaded: boolean
  backend: SecretBackend | null
  values: Map<SecretName, Entry>
  listeners: Set<() => void>
  loading: Promise<void> | null
  loadError: string | null
}

const state = globalState<SecretsState>('secrets', () => ({
  loaded: false,
  backend: null,
  values: new Map(),
  listeners: new Set(),
  loading: null,
  loadError: null,
}))

/** Starts or waits for the one-time load. */
export function secretsReady(): Promise<void> {
  state.loading ??= load()
  return state.loading
}

/** Drops a failed load and tries again, for the Settings retry button. */
export function reloadSecrets(): Promise<void> {
  state.loading = null
  state.loaded = false
  state.loadError = null
  state.values.clear()
  for (const listener of state.listeners) listener()
  return secretsReady()
}

/** Debug escape: NH_SECRETS_BACKEND=file bypasses the OS keychain. */
async function pickBackend(): Promise<SecretBackend> {
  if (process.env.NH_SECRETS_BACKEND?.trim() === 'file') return fileBackend()
  if (sessionRequired()) return bridgeBackend()
  return (await keychainBackend()) ?? fileBackend()
}

async function load(): Promise<void> {
  state.loadError = null
  try {
    let backend = state.backend ?? (await pickBackend())
    let stored: Partial<Record<SecretName, string>>
    try {
      stored = await backend.getAll()
    } catch (error) {
      if (!(error instanceof KeychainUnavailableError)) throw error
      backend = fileBackend()
      stored = await backend.getAll()
    }
    state.backend = backend

    for (const name of SECRET_NAMES) {
      const env = process.env[name]?.trim()
      if (env) {
        state.values.set(name, { value: env, source: 'env' })
        continue
      }
      const value = stored[name]
      if (value) state.values.set(name, { value, source: backend.kind })
    }
  } catch (error) {
    console.error('[not-higgsfield] secrets load failed', error)
    state.loadError = 'Keychain access was denied or timed out'
  } finally {
    state.loaded = true
    for (const listener of state.listeners) listener()
  }
}

/** Sync read from memory. Use this instead of reading process.env directly. */
export function getSecret(name: SecretName): string | null {
  return state.values.get(name)?.value ?? null
}

/** Applies changes at once (null removes). Env keys are read-only. */
export async function setSecrets(
  changes: Partial<Record<SecretName, string | null>>,
): Promise<void> {
  await withLock('secrets', () => applySecrets(changes))
}

async function applySecrets(changes: Partial<Record<SecretName, string | null>>): Promise<void> {
  await secretsReady()
  if (state.loadError) throw new HttpError(409, 'Keychain not loaded')
  const backend = state.backend
  if (!backend) throw new HttpError(500, 'No secret backend available')

  const next = new Map(state.values)
  const entries = Object.entries(changes) as [SecretName, string | null][]
  for (const [name, value] of entries) {
    if (state.values.get(name)?.source === 'env') {
      throw new HttpError(409, `${name} is set by environment`)
    }
    if (value === null) next.delete(name)
    else next.set(name, { value, source: backend.kind })
  }
  assertR2Group(next)

  try {
    for (const [name, value] of entries) {
      if (value === null) {
        if (state.values.has(name)) await backend.remove(name)
      } else {
        await backend.set(name, value)
      }
    }
  } catch (error) {
    console.error('[not-higgsfield] secret save failed', error)
    state.loading = null
    state.values.clear()
    await secretsReady()
    for (const listener of state.listeners) listener()
    throw new HttpError(500, 'Could not save to the keychain')
  }

  state.values = next
  for (const listener of state.listeners) listener()
}

/** Per-key status. Hints are the last four characters, never the value. */
export function secretStatus(): SecretStatus {
  const keys = {} as SecretStatus['keys']
  for (const name of SECRET_NAMES) {
    const entry = state.values.get(name)
    keys[name] = entry
      ? { set: true, source: entry.source, hint: hintFor(entry.value) }
      : { set: false, source: null, hint: null }
  }
  return {
    backend: state.backend?.kind ?? null,
    loading: !state.loaded,
    loadError: state.loadError,
    keys,
  }
}

/** Short values reveal too much in the last four characters. */
const hintFor = (value: string): string | null => (value.length < 12 ? null : value.slice(-4))

/** Fires after a save. Returns an unsubscribe function. */
export function onSecretsChange(listener: () => void): () => void {
  state.listeners.add(listener)
  return () => state.listeners.delete(listener)
}

function assertR2Group(values: Map<SecretName, Entry>): void {
  const count = R2_NAMES.filter((name) => values.has(name)).length
  if (count !== 0 && count !== R2_NAMES.length) {
    throw new HttpError(400, 'R2 needs all four fields')
  }
}

/** Test hook: installs a backend and clears loaded values. */
export function __setSecretsBackendForTests(backend: SecretBackend | null): void {
  state.loaded = false
  state.backend = backend
  state.values.clear()
  state.loading = null
  state.loadError = null
}

/** Test hook: drops all in-memory secret state. */
export function __resetSecretsForTests(): void {
  state.loaded = false
  state.backend = null
  state.values.clear()
  state.listeners.clear()
  state.loading = null
  state.loadError = null
}
