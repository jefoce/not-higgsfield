import 'server-only'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS } from '@/core/constants'
import type { TestResult } from '@/core/types'

import { messageOf } from '../errors'
import { isMockMode } from '../openrouter/client'
import { testR2 } from '../remote/r2'
import { getSecret, secretsReady } from '../secrets'

const BASE_URL = 'https://openrouter.ai'

const KeySchema = z.object({ data: z.object({ label: z.string().optional() }).loose() }).loose()

type TestTarget = 'openrouter' | 'r2'

/** Tests the stored credentials without returning them. */
export async function testConnection(target: TestTarget): Promise<TestResult> {
  await secretsReady()

  if (target === 'openrouter') {
    return testOpenRouter()
  }

  if ((process.env.REMOTE_MOCK?.trim() ?? '') !== '' && isMockMode()) {
    return { ok: true, mock: true }
  }

  return testR2()
}

async function testOpenRouter(): Promise<TestResult> {
  if (isMockMode()) {
    return { ok: true, mock: true }
  }

  const key = getSecret('OPENROUTER_API_KEY')

  if (isNil(key) || key === '') {
    return { ok: false, error: 'OpenRouter key is not set. Open Settings.' }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/key`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      return { ok: false, error: `OpenRouter ${res.status} ${res.statusText}` }
    }

    const parsed = KeySchema.safeParse(await res.json().catch(() => null))
    const label = parsed.success ? parsed.data.data.label : undefined

    if (isNil(label) || label === '') {
      return { ok: true }
    }

    return { ok: true, label }
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Test failed') }
  }
}
