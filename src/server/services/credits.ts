import 'server-only'

import { sumBy } from 'lodash-es'

import type { CreditsInfo } from '@/core/types'

import { getAccountCredits } from '../openrouter/credits'
import { listGenerations } from '../repos/generations'

interface GetCreditsParams {
  fresh?: boolean
}

/** Provider account credits combined with what this app spent locally. */
export async function getCredits(params: GetCreditsParams = {}): Promise<CreditsInfo> {
  const isFresh = params.fresh
  const account = await getAccountCredits({ fresh: isFresh })
  const localSpent = await spentLocally()

  return { ...account, localSpent }
}

async function spentLocally(): Promise<number> {
  const records = await listGenerations()

  return sumBy(records, (record) => record.cost.actualUsd ?? 0)
}
