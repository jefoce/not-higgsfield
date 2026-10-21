import 'server-only'
import readline from 'node:readline'
import { SECRET_NAMES, type SecretName } from '@/core/secret-names'
import type { SecretBackend } from './index'

export const BRIDGE_PREFIX = '@@nh-secrets '
const DEFAULT_TIMEOUT_MS = 60_000

export interface BridgeOptions {
  input?: NodeJS.ReadableStream
  output?: { write(chunk: string): unknown }
  timeoutMs?: number
}

interface Reply {
  id: number
  ok: boolean
  value?: string | null
  error?: string
  code?: string
}

/** Raised when the parent app reports no usable OS keychain. */
export class KeychainUnavailableError extends Error {
  readonly code = 'unavailable'

  constructor(message = 'No system keychain found') {
    super(message)
    this.name = 'KeychainUnavailableError'
  }
}

interface Pending {
  resolve(reply: Reply): void
  timer: NodeJS.Timeout
}

type Op = 'get' | 'set' | 'remove' | 'getAll'

interface CallParams {
  op: Op
  name: SecretName | ''
  value?: string
}

/** Desktop backend: asks the parent app over stdin/stdout. No keychain code in Node. */
export function bridgeBackend(options: BridgeOptions = {}): SecretBackend {
  const pending = new Map<number, Pending>()
  const output = options.output ?? process.stdout
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let next = 1

  const lines = readline.createInterface({ input: options.input ?? process.stdin })
  lines.on('line', (line) => {
    const reply = parseReply(line)
    if (!reply) return
    const entry = pending.get(reply.id)
    if (!entry) return
    pending.delete(reply.id)
    clearTimeout(entry.timer)
    entry.resolve(reply)
  })

  const call = (params: CallParams) => {
    const { op, name, value } = params
    return new Promise<Reply>((resolve, reject) => {
      const id = next++
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Keychain did not answer. Check for a macOS keychain prompt.'))
      }, timeoutMs)
      pending.set(id, { resolve, timer })
      output.write(`${BRIDGE_PREFIX}${JSON.stringify({ id, op, name, value })}\n`)
    })
  }

  return {
    kind: 'keychain',
    getAll: async () => parseAll(unwrap(await call({ op: 'getAll', name: '' })).value),
    get: async (name) => unwrap(await call({ op: 'get', name })).value ?? null,
    set: async (name, value) => {
      unwrap(await call({ op: 'set', name, value }))
    },
    remove: async (name) => {
      unwrap(await call({ op: 'remove', name }))
    },
  }
}

function parseReply(line: string): Reply | null {
  if (!line.startsWith('{')) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const reply = parsed as Partial<Reply>
  if (typeof reply.id !== 'number' || typeof reply.ok !== 'boolean') return null
  if (reply.value !== undefined && reply.value !== null && typeof reply.value !== 'string') return null
  if (reply.error !== undefined && typeof reply.error !== 'string') return null
  if (reply.code !== undefined && typeof reply.code !== 'string') return null
  return reply as Reply
}

function parseAll(raw: string | null | undefined): Partial<Record<SecretName, string>> {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Keychain returned a bad value')
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Keychain returned a bad value')

  const values: Partial<Record<SecretName, string>> = {}
  for (const name of SECRET_NAMES) {
    const value = (parsed as Record<string, unknown>)[name]
    if (typeof value === 'string' && value) values[name] = value
  }
  return values
}

function unwrap(reply: Reply): Reply {
  if (reply.ok) return reply
  if (reply.code === 'unavailable') throw new KeychainUnavailableError(reply.error)
  throw new Error(reply.error ?? 'Keychain request failed')
}
