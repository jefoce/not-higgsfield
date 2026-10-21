import 'server-only'
import { globalState } from '../global-state'
import { isMockMode } from '../openrouter/client'
import { getSecret, onSecretsChange } from '../secrets'
import { createMockStore } from './mock'
import { createR2Store } from './r2'

export interface RemoteObjectInfo {
  key: string
  size: number
  serverSha256: string | null
}

export interface RemotePutOptions {
  contentType: string
  sha256: string
  onProgress?: (sent: number, total: number) => void
}

export interface RemoteStore {
  head(key: string): Promise<RemoteObjectInfo | null>
  put(key: string, file: string, opts: RemotePutOptions): Promise<RemoteObjectInfo>
  presign(key: string, ttlSec: number, contentType: string): Promise<string>
  delete(key: string): Promise<void>
}

const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const

const cache = globalState('remoteStore', () => ({ value: undefined as RemoteStore | null | undefined }))

/** Mock wins only in mock provider mode, then complete R2 config, else null. */
export function getRemoteStore(): RemoteStore | null {
  if (cache.value !== undefined) return cache.value
  if (process.env.REMOTE_MOCK?.trim()) {
    if (isMockMode()) cache.value = createMockStore()
    else console.warn('[not-higgsfield] REMOTE_MOCK ignored: real OpenRouter cannot fetch 127.0.0.1 links')
  }
  if (cache.value === undefined && R2_KEYS.every((key) => Boolean(getSecret(key)))) {
    cache.value = createR2Store()
  }
  cache.value ??= null
  return cache.value
}

onSecretsChange(() => {
  cache.value = undefined
})
