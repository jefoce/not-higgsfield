import 'server-only'

import type { TestResult } from '@/core/types'

import { getVideoProvider, isMockMode } from '../providers/registry'
import { testR2 } from '../remote/r2'
import { secretsReady } from '../secrets'

type TestTarget = 'openrouter' | 'r2'

/** Tests the stored credentials without returning them. */
export async function testConnection(target: TestTarget): Promise<TestResult> {
  await secretsReady()

  if (target === 'openrouter') {
    return getVideoProvider('openrouter').testConnection()
  }

  if ((process.env.REMOTE_MOCK?.trim() ?? '') !== '' && isMockMode()) {
    return { ok: true, mock: true }
  }

  return testR2()
}
