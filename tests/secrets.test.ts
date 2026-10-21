import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SECRET_NAMES, type SecretName } from '@/core/secret-names'

type Backend = {
  kind: 'file'
  store: Map<string, string>
  getAll(): Promise<Partial<Record<SecretName, string>>>
  get(name: SecretName): Promise<string | null>
  set(name: SecretName, value: string): Promise<void>
  remove(name: SecretName): Promise<void>
}

function memoryBackend(values: Partial<Record<SecretName, string>> = {}): Backend {
  const store = new Map<string, string>()
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) store.set(name, value)
  }
  const all = async (): Promise<Partial<Record<SecretName, string>>> => {
    const values: Partial<Record<SecretName, string>> = {}
    for (const [name, value] of store) values[name as SecretName] = value
    return values
  }
  return {
    kind: 'file',
    store,
    getAll: all,
    get: async (name) => store.get(name) ?? null,
    set: async (name, value) => {
      store.set(name, value)
    },
    remove: async (name) => {
      store.delete(name)
    },
  }
}

async function setup(backend = memoryBackend()) {
  vi.resetModules()
  const secrets = await import('@/server/secrets')
  secrets.__resetSecretsForTests()
  secrets.__setSecretsBackendForTests(backend)
  await secrets.secretsReady()
  return { secrets, backend }
}

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nh-secrets-'))
  vi.stubEnv('STORAGE_ROOT', root)
  for (const name of SECRET_NAMES) vi.stubEnv(name, '')
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('secrets', () => {
  it('prefers env and rejects writes with 409', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'env-key')
    const { secrets } = await setup(memoryBackend({ OPENROUTER_API_KEY: 'stored' }))

    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('env-key')
    expect(secrets.secretStatus().keys.OPENROUTER_API_KEY.source).toBe('env')
    await expect(secrets.setSecrets({ OPENROUTER_API_KEY: 'next' })).rejects.toMatchObject({
      status: 409,
      message: 'OPENROUTER_API_KEY is set by environment',
    })
    await expect(secrets.setSecrets({ OPENROUTER_API_KEY: null })).rejects.toMatchObject({
      status: 409,
    })
  })

  it('sets and reads a key', async () => {
    const { secrets, backend } = await setup()

    await secrets.setSecrets({ OPENROUTER_API_KEY: 'abc12345' })

    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('abc12345')
    expect(backend.store.get('OPENROUTER_API_KEY')).toBe('abc12345')
    expect(secrets.secretStatus().keys.OPENROUTER_API_KEY.source).toBe('file')
  })

  it('removes a key', async () => {
    const { secrets, backend } = await setup()
    await secrets.setSecrets({ OPENROUTER_API_KEY: 'abc12345' })

    await secrets.setSecrets({ OPENROUTER_API_KEY: null })

    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBeNull()
    expect(backend.store.has('OPENROUTER_API_KEY')).toBe(false)
  })

  it('rejects a partial R2 group with 400', async () => {
    const { secrets, backend } = await setup()

    await expect(secrets.setSecrets({ R2_BUCKET: 'bucket' })).rejects.toMatchObject({
      status: 400,
      message: 'R2 needs all four fields',
    })
    expect(backend.store.size).toBe(0)
  })

  it('notifies listeners once per save', async () => {
    const { secrets } = await setup()
    const listener = vi.fn()
    const off = secrets.onSecretsChange(listener)

    await secrets.setSecrets({
      OPENROUTER_API_KEY: 'abc12345',
      OPENROUTER_MANAGEMENT_KEY: 'def67890',
    })
    expect(listener).toHaveBeenCalledTimes(1)

    off()
    await secrets.setSecrets({ OPENROUTER_API_KEY: 'abc99999' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('skips the backend remove for a key that is not stored', async () => {
    const { secrets, backend } = await setup()
    const remove = vi.spyOn(backend, 'remove')

    await secrets.setSecrets({ OPENROUTER_API_KEY: null })

    expect(remove).not.toHaveBeenCalled()
  })

  it('reloads stored keys and reports a 500 when the backend fails', async () => {
    const backend = memoryBackend({ OPENROUTER_API_KEY: 'stored' })
    backend.set = async () => {
      throw new Error('keychain denied')
    }
    const { secrets } = await setup(backend)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(secrets.setSecrets({ OPENROUTER_MANAGEMENT_KEY: 'next' })).rejects.toMatchObject({
      status: 500,
      message: 'Could not save to the keychain',
    })
    expect(secrets.getSecret('OPENROUTER_MANAGEMENT_KEY')).toBeNull()
    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('stored')
  })

  it('serializes concurrent saves so both keys survive', async () => {
    const { secrets } = await setup()

    await Promise.all([
      secrets.setSecrets({ OPENROUTER_API_KEY: 'key-a' }),
      secrets.setSecrets({ OPENROUTER_MANAGEMENT_KEY: 'key-b' }),
    ])

    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('key-a')
    expect(secrets.getSecret('OPENROUTER_MANAGEMENT_KEY')).toBe('key-b')
  })

  it('ignores stored values that fail the per-key schema', async () => {
    await fs.writeFile(
      path.join(root, 'secrets.json'),
      JSON.stringify({ R2_ACCOUNT_ID: 'not-hex', R2_BUCKET: 'bucket' }),
      { mode: 0o600 },
    )
    vi.resetModules()
    const { fileBackend } = await import('@/server/secrets/file')
    const backend = fileBackend()

    expect(await backend.get('R2_ACCOUNT_ID')).toBeNull()
    expect(await backend.get('R2_BUCKET')).toBe('bucket')
  })

  it('keeps a load error visible and refuses saves', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const backend = memoryBackend({ OPENROUTER_API_KEY: 'stored' })
    backend.getAll = async () => {
      throw new Error('denied')
    }
    const { secrets } = await setup(backend)

    expect(secrets.secretStatus().loadError).toBe(
      'Keychain access was denied or timed out',
    )
    expect(secrets.secretStatus().keys.OPENROUTER_API_KEY.set).toBe(false)
    await expect(secrets.setSecrets({ OPENROUTER_MANAGEMENT_KEY: 'next' })).rejects.toMatchObject({
      status: 409,
      message: 'Keychain not loaded',
    })
  })

  it('falls back to the file backend when the keychain is unavailable', async () => {
    vi.resetModules()
    const { KeychainUnavailableError } = await import('@/server/secrets/bridge')
    const bridge = memoryBackend()
    bridge.getAll = async () => {
      throw new KeychainUnavailableError('no secret service')
    }
    const secrets = await import('@/server/secrets')
    secrets.__resetSecretsForTests()
    secrets.__setSecretsBackendForTests(bridge)
    await secrets.secretsReady()

    expect(secrets.secretStatus().backend).toBe('file')
    expect(secrets.secretStatus().loadError).toBeNull()

    await secrets.setSecrets({ OPENROUTER_API_KEY: 'abc12345' })
    const { fileBackend } = await import('@/server/secrets/file')
    expect(await fileBackend().get('OPENROUTER_API_KEY')).toBe('abc12345')
  })

  it('reloads after a transient load error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const backend = memoryBackend({ OPENROUTER_API_KEY: 'stored' })
    const read = backend.getAll
    let denied = true
    backend.getAll = async () => {
      if (denied) throw new Error('denied')
      return read()
    }
    const { secrets } = await setup(backend)
    expect(secrets.secretStatus().loadError).not.toBeNull()

    denied = false
    await secrets.reloadSecrets()

    expect(secrets.secretStatus().loadError).toBeNull()
    expect(secrets.getSecret('OPENROUTER_API_KEY')).toBe('stored')
  })

  it('returns only the last four characters as a hint, and none for short values', async () => {
    const { secrets } = await setup()
    await secrets.setSecrets({
      OPENROUTER_API_KEY: 'abcdefghijkl',
      OPENROUTER_MANAGEMENT_KEY: 'short',
    })

    const status = secrets.secretStatus()

    expect(status.keys.OPENROUTER_API_KEY).toMatchObject({
      set: true,
      hint: 'ijkl',
    })
    expect(status.keys.OPENROUTER_MANAGEMENT_KEY.hint).toBeNull()
    expect(JSON.stringify(status)).not.toContain('abcdefghijkl')
  })
})
