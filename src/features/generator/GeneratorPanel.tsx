'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { Settings } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { MEDIA_KINDS } from '@/core/media-kinds'
import { billableSeconds, pricePerSec } from '@/core/pricing'
import { getPreset } from '@/core/presets'
import { referenceSlots } from '@/core/prompt-tokens'
import type { GenerationInput, MediaKind, UploadItem } from '@/core/types'
import { validateInput } from '@/core/validation'
import { fetchUploads, uploadFiles } from '@/features/media-picker/api'
import { extensionsFromLimits, type PickerExtensions } from '@/features/media-picker/store'
import { usePasteMedia } from '@/features/media-picker/use-paste-media'
import { errorMessage } from '@/lib/errors'
import { openSettings } from '@/features/settings/settings-store'
import { useSecrets } from '@/features/settings/use-secrets'
import { CreditsBadge } from './CreditsBadge'
import { FrameSlots } from './FrameSlots'
import { GenerateButton } from './GenerateButton'
import { ModeTabs } from './ModeTabs'
import { ModelPicker } from './ModelPicker'
import { PromptField } from './PromptField'
import { ReferencesBox } from './ReferencesBox'
import { SettingsRow } from './SettingsRow'
import { useGenerate } from './use-generate'
import { usePricing } from './use-pricing'
import { useRemoteStatus } from './use-remote-status'
import { useGeneratorStore } from './store'

const emptySubscribe = () => () => {}

function route(items: UploadItem[]): void {
  const state = useGeneratorStore.getState()
  if (state.tab === 'references') {
    state.addReferences(items)
    return
  }

  const preset = getPreset(state.presetId)
  let slot: 'start' | 'end' = 'start'
  if (state.frames.start && preset.frames.end && !state.frames.end) slot = 'end'
  const image = items.find((item) => item.kind === 'image')
  if (!image) {
    toast.error('Frames need an image')
    return
  }
  state.setFrame(slot, image)
}

/** Kinds the active tab can still take. */
function allowedKinds(): MediaKind[] {
  const state = useGeneratorStore.getState()
  if (state.tab !== 'references') return ['image']
  const preset = getPreset(state.presetId)
  const { counts } = referenceSlots(state.references, (id) => state.uploadsById[id]?.kind)
  return MEDIA_KINDS.filter((kind) => counts[kind] < preset.references[kind])
}

/** Preset formats for the active model. */
function allowedExtensions(): PickerExtensions | undefined {
  return extensionsFromLimits(getPreset(useGeneratorStore.getState().presetId).referenceLimits)
}

/** Left generate panel: tabs, prompt, settings, warnings, generate. */
export function GeneratorPanel() {
  const { presetId, tab, prompt, audio, duration, aspectRatio, resolution, frames, references, uploadsById, seed } =
    useGeneratorStore(
      useShallow((state) => ({
        presetId: state.presetId,
        tab: state.tab,
        prompt: state.prompts[state.tab],
        audio: state.audio,
        duration: state.duration,
        aspectRatio: state.aspectRatio,
        resolution: state.resolution,
        frames: state.frames,
        references: state.references,
        uploadsById: state.uploadsById,
        seed: state.seed,
      })),
    )
  const preset = getPreset(presetId)
  const activeCount = useGeneratorStore((state) => state.activeCount)
  const { generate, isGenerating } = useGenerate()
  const onPasteFiles = useCallback((files: File[]) => {
    void uploadFiles(files)
      .then(route)
      .catch((error) => toast.error(errorMessage(error)))
  }, [])
  const { onPaste } = usePasteMedia({
    enabled: true,
    scope: 'element',
    kinds: allowedKinds,
    extensions: allowedExtensions,
    onFiles: onPasteFiles,
    onUploaded: route,
  })
  const { pricing } = usePricing()
  const remoteConfigured = useRemoteStatus()
  const { status: secrets } = useSecrets()
  const keyMissing = secrets ? !secrets.keys.OPENROUTER_API_KEY.set : false
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  const input = useMemo<GenerationInput>(
    () => ({ presetId, tab, prompt, audio, duration, aspectRatio, resolution, frames, references, seed }),
    [presetId, tab, prompt, audio, duration, aspectRatio, resolution, frames, references, seed],
  )
  const validation = useMemo(
    () => validateInput({ input, uploads: uploadsById, preset, ctx: { activeCount, remoteConfigured } }),
    [input, uploadsById, preset, activeCount, remoteConfigured],
  )
  const onSubmit = useCallback(() => {
    if (validation.ok) void generate()
  }, [validation.ok, generate])

  const hasVideoInput =
    tab === 'references' && references.some((id) => uploadsById[id]?.kind === 'video')
  const rate = pricePerSec({
    preset,
    ctx: { resolution, aspect: aspectRatio, audio, hasVideoInput },
    skus: pricing?.skus,
  })
  const price = rate === null ? null : rate * billableSeconds(preset, duration)

  const idsKey = useMemo(
    () =>
      [...new Set([frames.start, frames.end, ...references])]
        .filter((id): id is string => Boolean(id))
        .sort()
        .join(','),
    [frames.start, frames.end, references],
  )

  useEffect(() => {
    const refresh = () => {
      const ids = idsKey.split(',').filter(Boolean)
      if (!ids.length) return
      void fetchUploads({ ids })
        .then((items) => useGeneratorStore.getState().upsertUploads(items))
        .catch((error) => toast.error(errorMessage(error)))
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [idsKey])

  if (!mounted) return <div className="h-full" />

  return (
    <div className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-panel" onPaste={onPaste}>
      <div
        id="generator-panel"
        data-generator-panel
        className="min-h-0 flex-1 overflow-y-auto px-2 pt-3"
      >
        <div className="mb-6 flex h-9 items-center justify-between">
          <span className="relative flex h-full items-center ml-1 pb-2 text-sm font-medium">
            Create Video
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white" />
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Settings"
              onClick={() => openSettings()}
              className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-fg-2 hover:bg-hover hover:text-fg"
            >
              <Settings size={14} aria-hidden />
              {keyMissing && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger" />
              )}
            </button>
            <CreditsBadge />
          </div>
        </div>
        <ModeTabs />
        <div className="mb-4">
          {tab === 'frames' ? <FrameSlots /> : <ReferencesBox />}
        </div>
        <PromptField onSubmit={onSubmit} warnings={validation.warnings} />
        <ModelPicker />
        <SettingsRow />
      </div>
      <div className="px-4 pb-3 pt-3">
        <GenerateButton
          onGenerate={onSubmit}
          isGenerating={isGenerating}
          disabled={!validation.ok}
          error={validation.errors[0]}
          price={price}
        />
      </div>
    </div>
  )
}
