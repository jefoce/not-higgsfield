'use client'

import { useEffect } from 'react'

import { UPDATE_CHECK_DELAY_MS, UPDATE_CHECK_INTERVAL_MS } from '@/core/constants'
import { platform } from '@/lib/platform'

import { checkForUpdate } from './check-update'
import { useUpdateStore } from './update-store'

type TimerId = ReturnType<typeof setTimeout>

/** Mount once in the app shell: reads app info, checks after 15 s and every 12 h. */
export function useUpdateCheck(): void {
  useEffect(() => {
    let isCancelled = false
    let firstCheck: TimerId | undefined
    let repeatCheck: TimerId | undefined

    void platform
      .appInfo()
      .then((info) => {
        useUpdateStore.getState().setAppInfo(info)

        const shouldCheck = !isCancelled && info.installKind !== 'browser' && info.autoCheck

        if (!shouldCheck) {
          return
        }

        firstCheck = setTimeout(() => {
          void checkForUpdate(false)
        }, UPDATE_CHECK_DELAY_MS)

        repeatCheck = setInterval(() => {
          void checkForUpdate(false)
        }, UPDATE_CHECK_INTERVAL_MS)
      })
      .catch(() => {})

    return () => {
      isCancelled = true
      clearTimeout(firstCheck)
      clearInterval(repeatCheck)
    }
  }, [])
}
