import 'server-only'

import { isNil } from 'lodash-es'

import type { TestResult } from '@/core/types'

import { getVideoProvider } from '../providers/registry'
import { secretsReady } from '../secrets'
import { testR2 } from '../storage/r2'
import { getObjectStore } from '../storage/registry'

type TestTarget = 'openrouter' | 'r2'

/** Tests the stored credentials without returning them. */
export async function testConnection(target: TestTarget): Promise<TestResult> {
  await secretsReady()

  if (target === 'openrouter') {
    return getVideoProvider('openrouter').testConnection()
  }

  const store = getObjectStore()

  if (isNil(store)) {
    return testR2()
  }

  return store.testConnection()
}
