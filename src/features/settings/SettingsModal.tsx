'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import useSWR from 'swr'
import type { CreditsInfo } from '@/core/types'
import { fetcher } from '@/lib/fetcher'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { OPENROUTER_FIELDS, R2_FIELDS } from './SecretFields'
import { SecretSection } from './SecretSection'
import { useSettingsStore } from './settings-store'
import { useSettingsDraft } from './use-settings-draft'
import { backendNote, useSecrets, useSettingsPrompt } from './use-secrets'

/** Stored key editor: status, save, remove and test. */
export function SettingsModal() {
  const open = useSettingsStore((state) => state.open)
  const section = useSettingsStore((state) => state.section)
  const closeSettings = useSettingsStore((state) => state.closeSettings)
  const { status } = useSecrets()
  const { data: credits } = useSWR<CreditsInfo>('/api/credits', fetcher, { revalidateOnFocus: false })
  const mock = credits ? credits.source === 'mock' : undefined
  useSettingsPrompt(status, mock)

  const {
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
  } = useSettingsDraft({ status, open, mock, closeSettings })

  const openrouterRef = useRef<HTMLElement>(null)
  const r2Ref = useRef<HTMLElement>(null)
  const note = backendNote(status?.backend)

  useEffect(() => {
    if (!open) return
    const target = section === 'r2' ? r2Ref.current : openrouterRef.current
    target?.scrollIntoView({ block: 'nearest' })
  }, [open, section, status])

  const renderBody = () => {
    if (status?.loadError) {
      return (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3">
          <p className="text-xs text-danger">{status.loadError}</p>
          <Button size="sm" variant="outline" loading={retrying} onClick={() => void onRetry()}>
            Retry
          </Button>
        </div>
      )
    }
    if (status?.loading) {
      return <p className="text-xs text-fg-2">Waiting for keychain access...</p>
    }
    if (!status) return <p className="text-xs text-fg-2">Loading keys...</p>

    return (
      <>
        <SecretSection
          sectionRef={openrouterRef}
          title="OpenRouter"
          fields={OPENROUTER_FIELDS}
          keys={status.keys}
          values={edits}
          onChange={onFieldChange}
          ready={openrouterReady}
          testing={testing === 'openrouter'}
          result={results.openrouter}
          onTest={() => void onTest('openrouter')}
        />

        <SecretSection
          sectionRef={r2Ref}
          title="Cloudflare R2"
          description={
            <span className="text-right text-xxs text-fg-2">
              optional, needed for video/audio refs on some models
            </span>
          }
          fields={R2_FIELDS}
          keys={status.keys}
          values={edits}
          onChange={onFieldChange}
          ready={r2Ready}
          testing={testing === 'r2'}
          result={results.r2}
          warning={!r2Valid && <p className="text-xxs text-danger">R2 needs all four fields</p>}
          onTest={() => void onTest('r2')}
        />
      </>
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      label="Settings"
      className="flex max-h-[85vh] w-[min(560px,92vw)] flex-col"
    >
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 className="text-sm font-semibold text-fg">Settings</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => void onClose(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-2 hover:bg-hover hover:text-fg"
        >
          <X size={15} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-3">{renderBody()}</div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className="text-xxs text-fg-2">{note}</p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={() => void onClose(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!canSave}
            loading={saving}
            onClick={() => void onSave()}
          >
            Save
          </Button>
        </div>
      </footer>
    </Modal>
  )
}
