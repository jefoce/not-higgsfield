import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { isRecord } from '@/core/guards'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONFIGS = ['tauri.conf.json', 'tauri.updater.conf.json']

const INSECURE_KEYS = new Set([
  'dangerousInsecureTransportProtocol',
  'dangerous-insecure-transport-protocol',
])

/** Finds the insecure transport key at any depth, returning its path. */
function findInsecureKey(value: unknown, parent = ''): string | null {
  if (Array.isArray(value)) {
    return (
      value
        .map((item, index) => {
          return findInsecureKey(item, `${parent}[${index}]`)
        })
        .find((found) => {
          return found !== null
        }) ?? null
    )
  }

  if (!isRecord(value)) {
    return null
  }

  return (
    Object.keys(value)
      .map((key) => {
        const here = parent === '' ? key : `${parent}.${key}`

        if (INSECURE_KEYS.has(key)) {
          return here
        }

        return findInsecureKey(value[key], here)
      })
      .find((found) => {
        return found !== null
      }) ?? null
  )
}

describe('updater config', () => {
  it.each(CONFIGS)('%s does not allow insecure transport', (name) => {
    const file = path.join(ROOT, 'src-tauri', name)
    const config = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown

    expect(findInsecureKey(config)).toBeNull()
  })

  it('finds the flag when it is nested', () => {
    const config = {
      plugins: { updater: [{ dangerousInsecureTransportProtocol: true }] },
    }

    expect(findInsecureKey(config)).toBe('plugins.updater[0].dangerousInsecureTransportProtocol')
  })
})
