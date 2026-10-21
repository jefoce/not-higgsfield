'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { secretError } from '@/core/secret-names'
import { errorMessage } from '@/lib/errors'
import { platform } from '@/lib/platform'
import { refreshCredits } from '@/features/generator/use-credits'
import type { SecretChange } from './SecretFields'
import type { SettingsSection } from './settings-store'
import {
  R2_NAMES,
  retrySecrets,
  saveSecrets,
  testLine,
  testTarget,
  type SecretName,
  type SecretStatus,
  type TestMessage,
} from './use-secrets'

const EMPTY_RESULTS: Record<SettingsSection, TestMessage | null> = { openrouter: null, r2: null }

type Edits = Partial<Record<SecretName, string | null>>

interface UseSettingsDraftParams {
  status: SecretStatus | undefined
  open: boolean
  mock: boolean | undefined
  closeSettings: () => void
}

/** Draft edits, test results and save/close actions for the settings modal. */
export function useSettingsDraft(params: UseSettingsDraftParams) {
  const { status, open, mock, closeSettings } = params
  const [edits, setEdits] = useState<Edits>({})
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [testing, setTesting] = useState<SettingsSection | null>(null)
  const [saving, setSaving] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const changed = Object.keys(edits) as SecretName[]
  const dirty = changed.length > 0
  const allValid = changed.every(
    (name) => edits[name] === null || secretError(name, edits[name] ?? '') === null,
  )
  const r2Set = R2_NAMES.filter((name) => {
    const edit = edits[name]
    if (edit === null) return false
    return edit === undefined ? Boolean(status?.keys[name].set) : true
  }).length
  const r2Valid = r2Set === 0 || r2Set === R2_NAMES.length
  const canSave = !status?.loadError && dirty && allValid && r2Valid && !saving
  const openrouterReady = mock === true || Boolean(status?.keys.OPENROUTER_API_KEY.set)
  const r2Ready = mock === true || R2_NAMES.every((name) => Boolean(status?.keys[name].set))

  useEffect(() => {
    if (!open) return
    setEdits({})
    setResults(EMPTY_RESULTS)
  }, [open])

  const onFieldChange = (name: SecretName, change: SecretChange) => {
    setEdits((current) => {
      const next = { ...current }
      if (change.remove) next[name] = null
      else if (!change.value) delete next[name]
      else next[name] = change.value
      return next
    })
  }

  const onClose = async (next: boolean) => {
    if (next) return
    if (dirty && !(await platform.confirm('Discard changes?'))) return
    closeSettings()
    setEdits({})
    setResults(EMPTY_RESULTS)
  }

  const onTest = async (target: SettingsSection) => {
    if (dirty) {
      setResults((current) => ({ ...current, [target]: { tone: 'info', text: 'Save first to test' } }))
      return
    }
    setTesting(target)
    try {
      const result = await testTarget(target)
      setResults((current) => ({ ...current, [target]: testLine(target, result) }))
    } catch (error) {
      setResults((current) => ({
        ...current,
        [target]: { tone: 'error', text: errorMessage(error, 'Test failed') },
      }))
    } finally {
      setTesting(null)
    }
  }

  const onRetry = async () => {
    setRetrying(true)
    try {
      await retrySecrets()
    } catch (error) {
      toast.error(errorMessage(error, 'Retry failed'))
    } finally {
      setRetrying(false)
    }
  }

  const onSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await saveSecrets(edits)
      await refreshCredits()
      setEdits({})
      setResults(EMPTY_RESULTS)
      toast.success('Settings saved')
    } catch (error) {
      toast.error(errorMessage(error, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  return {
    edits,
    results,
    testing,
    saving,
    retrying,
    canSave,
    r2Valid,
    openrouterReady,
    r2Ready,
    onFieldChange,
    onClose,
    onTest,
    onRetry,
    onSave,
  }
}
