'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'

interface RemoteStatus {
  configured: boolean
  mock: boolean
}

/** True when R2 or the mock store is configured. False while loading. */
export function useRemoteStatus(): boolean {
  const { data } = useSWR<RemoteStatus>('/api/remote/status', fetcher, {
    revalidateOnFocus: false,
  })
  return data?.configured ?? false
}
