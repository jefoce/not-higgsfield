'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { inputForSubmit } from '@/core/normalize-input'
import { getPreset } from '@/core/presets'
import { friendlyError } from '@/core/provider-errors'
import { openSettings } from '@/features/settings/settings-store'
import { refreshCredits } from '@/lib/api/credits'
import { cancelGenerationRequest, createGeneration } from '@/lib/api/generations'
import { errorMessage } from '@/lib/errors'
import { ApiError } from '@/lib/fetcher'
import { getPlatform } from '@/lib/platform'
import { refreshHistory } from '@/lib/swr-keys'

import { useGeneratorStore } from '../store/store'
import { inputFromState } from '../store/store-draft'

function requestNotifications(): void {
  void getPlatform()
    .then((platform) => platform.requestNotifications())
    .catch(() => {})
}

/** Cancels a generation still inside the submit grace window. */
async function cancelGeneration(id: string): Promise<void> {
  try {
    await cancelGenerationRequest(id)
    toast.success('Generation cancelled')
    await refreshHistory()
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast.error('Already sent, cannot cancel')
      await refreshHistory()

      return
    }

    toast.error(errorMessage(error))
  }
}

interface ShowErrorParams {
  message: string
  presetId: string
  presetTitle: string
}

/** Shows the plain error with the preset name, plus Settings when the key is missing. */
function showError(params: ShowErrorParams): void {
  const { message, presetId, presetTitle } = params
  const friendly = friendlyError({ raw: message, family: getPreset(presetId).family })
  const title = `${presetTitle}: ${friendly.title}`

  if (!message.includes('key is not set')) {
    toast.error(title)

    return
  }

  toast.error(title, {
    action: { label: 'Open Settings', onClick: () => openSettings('openrouter') },
  })
}

/** Submits the draft, refreshes generation lists and credits. Returns the record id. */
export function useGenerate() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const generate = useCallback(async (): Promise<string | null> => {
    if (inFlight.current) {
      return null
    }

    inFlight.current = true
    requestNotifications()
    setIsGenerating(true)
    setError(null)

    try {
      const input = inputForSubmit(inputFromState(useGeneratorStore.getState()))
      const record = await createGeneration(input)

      setIsGenerating(false)

      if (record.status === 'failed') {
        showError({
          message: record.error ?? 'Submit failed',
          presetId: record.input.presetId,
          presetTitle: record.preset.title,
        })
      } else {
        toast.success('Generation starts in 10s', {
          action: { label: 'Undo', onClick: () => void cancelGeneration(record.id) },
        })
      }

      await Promise.all([refreshHistory(), refreshCredits()])

      return record.id
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Request failed'
      const preset = getPreset(useGeneratorStore.getState().presetId)

      setError(message)
      showError({ message, presetId: preset.id, presetTitle: preset.title })

      return null
    } finally {
      inFlight.current = false
      setIsGenerating(false)
    }
  }, [])

  return { generate, isGenerating, error }
}
