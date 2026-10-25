'use client'

import { isNil } from 'lodash-es'

import { messageOf } from '@/core/errors'
import { platform } from '@/lib/platform'
import { type AsyncAction, useAsyncAction } from '@/lib/use-async-action'

import { useUpdateStore } from './update-store'

/** Shared install action for the toast and Settings. A cancel restores the available update. */
export function useInstallUpdate(): AsyncAction<[]> {
  return useAsyncAction(async () => {
    const state = useUpdateStore.getState()
    const update = state.update

    if (isNil(update)) {
      return
    }

    state.startInstall()

    try {
      const result = await platform.installUpdate((progress) => {
        useUpdateStore.getState().setProgress(progress)
      })

      if (result.cancelled) {
        useUpdateStore.getState().markCancelled(update)
      }
    } catch (error) {
      useUpdateStore.getState().markError(messageOf(error, 'Update failed'))
    }
  })
}
