'use client'

import { clamp, isNil, keyBy, omit } from 'lodash-es'
import { toast } from 'sonner'
import type { StateCreator } from 'zustand'

import { SEED_MAX } from '@/core/constants'
import { maxDurationFor } from '@/core/duration-limits'
import { isNonEmptyString } from '@/core/guards'
import { clampDuration, normalizeForPreset } from '@/core/normalize-input'
import { findPreset, getPreset } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import type { RefSlot } from '@/core/prompt-tokens'
import type { GenerationInput, GeneratorTab } from '@/core/schemas/generation-record'

import { defaults, inputFromState } from './store-draft'
import { createFrameActions } from './store-frame-actions'
import { clampReferenceDuration, randomSeed } from './store-helpers'
import { createLoadActions } from './store-load-actions'
import { createReferenceActions } from './store-reference-actions'
import type { GeneratorState } from './store-state'

type MentionInserter = (slot: RefSlot) => void

type SlotFocuser = (slot: RefSlot, occurrence: number) => void

let mentionInserter: MentionInserter | null = null
let slotFocuser: SlotFocuser | null = null

function clampSeed(seed: number | null): number | null {
  if (isNil(seed)) {
    return null
  }

  return clamp(Math.round(seed), 0, SEED_MAX)
}

interface NormalizedDraftParams {
  state: GeneratorState
  preset: ModelPreset
  overrides?: Partial<GenerationInput>
}

interface NextTabStateParams {
  state: GeneratorState
  preset: ModelPreset
  tab: GeneratorTab
}

function nextTabState(params: NextTabStateParams): Partial<GeneratorState> {
  const { state, preset, tab } = params

  const isInvalid =
    state.aspectRatio === 'auto' && (tab !== 'frames' || !isNonEmptyString(state.frames.start))

  const aspectRatio = isInvalid ? preset.defaultAspectRatio : state.aspectRatio

  return {
    tab,
    aspectRatio,
    duration: clampReferenceDuration({
      input: inputFromState({ ...state, tab }),
      uploads: state.uploadsById,
      preset,
    }),
  }
}

/** Normalizes a draft to the preset, toasts the notes and drops the per-tab prompt. */
function normalizedDraft(params: NormalizedDraftParams): Partial<GeneratorState> {
  const { state, preset, overrides } = params

  const { input, notes } = normalizeForPreset({
    input: { ...inputFromState(state), ...overrides },
    preset,
    uploads: state.uploadsById,
  })

  if (notes.length > 0) {
    toast(notes.join(' \u00b7 '))
  }

  return omit(input, 'prompt')
}

/** Draft state and its actions, wired to persist by store.ts. */
export const createGeneratorState: StateCreator<
  GeneratorState,
  [['zustand/persist', unknown]],
  []
> = (set, get) => ({
  ...defaults(),
  uploadsById: {},
  activeCount: 0,
  setActiveCount: (activeCount) => set({ activeCount }),
  setPreset: (id) =>
    set((state) => {
      const preset = findPreset(id)

      if (!preset) {
        return {}
      }

      return normalizedDraft({ state, preset })
    }),
  setTab: (tab) => set((state) => nextTabState({ state, preset: getPreset(state.presetId), tab })),
  setPrompt: (text) => set((state) => ({ prompts: { ...state.prompts, [state.tab]: text } })),
  setAudio: (isAudio) => set({ audio: isAudio }),
  setDuration: (duration) =>
    set((state) => {
      const preset = getPreset(state.presetId)

      const limit = maxDurationFor({
        input: inputFromState(state),
        uploads: state.uploadsById,
        preset,
      })

      return { duration: clampDuration({ value: duration, preset, limit }) }
    }),
  setAspectRatio: (aspectRatio) =>
    set((state) => {
      if (aspectRatio !== 'auto') {
        return { aspectRatio }
      }

      const preset = getPreset(state.presetId)

      const isAllowed =
        state.tab === 'frames' && Boolean(state.frames.start) && preset.autoAspectWithFrames

      const nextAspectRatio = isAllowed ? aspectRatio : preset.defaultAspectRatio

      return { aspectRatio: nextAspectRatio }
    }),
  setResolution: (resolution) =>
    set((state) =>
      normalizedDraft({ state, preset: getPreset(state.presetId), overrides: { resolution } }),
    ),
  ...createFrameActions(set),
  ...createReferenceActions(set),
  insertMention: (slot) => mentionInserter?.(slot),
  focusSlot: (slot, occurrence) => slotFocuser?.(slot, occurrence),
  setSeed: (seed) => set({ seed: clampSeed(seed) }),
  toggleSeedLock: () =>
    set((state) => {
      if (isNil(state.seed)) {
        return { seed: randomSeed() }
      }

      return { seed: null }
    }),
  ...createLoadActions(set, get),
  reset: () => set({ ...defaults() }),
  registerMentionInserter: (fn) => {
    mentionInserter = fn
  },
  registerSlotFocuser: (fn) => {
    slotFocuser = fn
  },
  upsertUploads: (uploads) => {
    set((state) => ({ uploadsById: { ...state.uploadsById, ...keyBy(uploads, 'id') } }))
    get().normalizeLoaded()
  },
})
