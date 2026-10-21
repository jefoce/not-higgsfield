'use client'

import { clamp, isEqual, keyBy, omit, pick, uniq } from 'lodash-es'
import { toast } from 'sonner'
import type { StateCreator } from 'zustand'
import { SEED_MAX } from '@/core/constants'
import { clampDuration, normalizeForPreset } from '@/core/normalize-input'
import { DEFAULT_PRESET_ID, findPreset, getPreset, type ModelPreset } from '@/core/presets'
import { canonicalizePrompt, referenceSlots, type RefSlot } from '@/core/prompt-tokens'
import type { GenerationInput, GeneratorTab, UploadItem } from '@/core/types'
import { maxDurationFor } from '@/core/validation'
import { defaults, inputFromState, type GeneratorDraft } from './store-draft'
import { clampReferenceDuration, kindCounts, randomSeed } from './store-helpers'

type MentionInserter = (slot: RefSlot) => void
type SlotFocuser = (slot: RefSlot, occurrence: number) => void
let mentionInserter: MentionInserter | null = null
let slotFocuser: SlotFocuser | null = null

export interface GeneratorState extends GeneratorDraft {
  uploadsById: Record<string, UploadItem>
  activeCount: number
  setActiveCount: (count: number) => void
  setPreset: (id: string) => void
  setTab: (tab: GeneratorTab) => void
  setPrompt: (text: string) => void
  setAudio: (audio: boolean) => void
  setDuration: (duration: number) => void
  setAspectRatio: (aspectRatio: GenerationInput['aspectRatio']) => void
  setResolution: (resolution: GenerationInput['resolution']) => void
  setFrame: (slot: 'start' | 'end', upload: UploadItem | null) => void
  addReferences: (uploads: UploadItem[]) => void
  replaceReference: (id: string, upload: UploadItem) => void
  removeReference: (id: string) => void
  insertMention: (slot: RefSlot) => void
  focusSlot: (slot: RefSlot, occurrence: number) => void
  setSeed: (seed: number | null) => void
  toggleSeedLock: () => void
  loadInput: (input: GenerationInput, uploads: UploadItem[]) => void
  normalizeLoaded: () => void
  reset: () => void
  registerMentionInserter: (fn: MentionInserter | null) => void
  registerSlotFocuser: (fn: SlotFocuser | null) => void
  upsertUploads: (uploads: UploadItem[]) => void
}

interface NormalizedDraftParams {
  state: GeneratorState
  preset: ModelPreset
  overrides?: Partial<GenerationInput>
}

/** Normalizes a draft to the preset, toasts the notes and drops the per-tab prompt. */
function normalizedDraft(params: NormalizedDraftParams): Partial<GeneratorState> {
  const { state, preset, overrides } = params
  const { input, notes } = normalizeForPreset({
    input: { ...inputFromState(state), ...overrides },
    preset,
    uploads: state.uploadsById,
  })
  if (notes.length) toast(notes.join(' \u00b7 '))
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
      if (!preset) return {}
      return normalizedDraft({ state, preset })
    }),
  setTab: (tab) =>
    set((state) => {
      const preset = getPreset(state.presetId)
      const invalid = state.aspectRatio === 'auto' && (tab !== 'frames' || !state.frames.start)
      return {
        tab,
        aspectRatio: invalid ? preset.defaultAspectRatio : state.aspectRatio,
        duration: clampReferenceDuration({
          input: inputFromState({ ...state, tab }),
          uploads: state.uploadsById,
          preset,
        }),
      }
    }),
  setPrompt: (text) => set((state) => ({ prompts: { ...state.prompts, [state.tab]: text } })),
  setAudio: (audio) => set({ audio }),
  setDuration: (duration) =>
    set((state) => {
      const preset = getPreset(state.presetId)
      const limit = maxDurationFor({
        input: inputFromState(state),
        uploads: state.uploadsById,
        preset,
      })
      return { duration: clampDuration(duration, preset, limit) }
    }),
  setAspectRatio: (aspectRatio) =>
    set((state) => {
      if (aspectRatio !== 'auto') return { aspectRatio }
      const preset = getPreset(state.presetId)
      const allowed =
        state.tab === 'frames' && Boolean(state.frames.start) && preset.autoAspectWithFrames
      return { aspectRatio: allowed ? aspectRatio : preset.defaultAspectRatio }
    }),
  setResolution: (resolution) =>
    set((state) =>
      normalizedDraft({ state, preset: getPreset(state.presetId), overrides: { resolution } }),
    ),
  setFrame: (slot, upload) =>
    set((state) => {
      const preset = getPreset(state.presetId)
      const frames = { ...state.frames, [slot]: upload?.id ?? null }
      const clearsStart = slot === 'start' && !upload
      if (clearsStart) frames.end = null
      const uploadsById = upload ? { ...state.uploadsById, [upload.id]: upload } : state.uploadsById
      const aspectRatio =
        clearsStart && state.aspectRatio === 'auto' ? preset.defaultAspectRatio : state.aspectRatio
      return { frames, uploadsById, aspectRatio }
    }),
  addReferences: (items) =>
    set((state) => {
      const preset = getPreset(state.presetId)
      const uploadsById = { ...state.uploadsById }
      const references = [...state.references]
      const counts = kindCounts(references, uploadsById)
      for (const item of items) {
        uploadsById[item.id] = item
        if (references.includes(item.id)) continue
        if (counts[item.kind] >= preset.references[item.kind]) continue
        references.push(item.id)
        counts[item.kind] += 1
      }
      const duration = clampReferenceDuration({
        input: inputFromState({ ...state, references }),
        uploads: uploadsById,
        preset,
      })
      return { references, uploadsById, duration }
    }),
  replaceReference: (id, upload) =>
    set((state) => {
      const uploadsById = { ...state.uploadsById, [upload.id]: upload }
      const index = state.references.indexOf(id)
      const swapped = state.references.map((ref) => (ref === id ? upload.id : ref))
      const references = uniq(index < 0 ? [...swapped, upload.id] : swapped)
      const preset = getPreset(state.presetId)
      const duration = clampReferenceDuration({
        input: inputFromState({ ...state, references }),
        uploads: uploadsById,
        preset,
      })
      return { references, uploadsById, duration }
    }),
  removeReference: (id) =>
    set((state) => {
      const references = state.references.filter((ref) => ref !== id)
      const preset = getPreset(state.presetId)
      const duration = clampReferenceDuration({
        input: inputFromState({ ...state, references }),
        uploads: state.uploadsById,
        preset,
      })
      return { references, duration }
    }),
  insertMention: (slot) => mentionInserter?.(slot),
  focusSlot: (slot, occurrence) => slotFocuser?.(slot, occurrence),
  setSeed: (seed) => set({ seed: seed === null ? null : clamp(Math.round(seed), 0, SEED_MAX) }),
  toggleSeedLock: () => set((state) => ({ seed: state.seed === null ? randomSeed() : null })),
  loadInput: (input, uploads) => {
    const cache = { ...get().uploadsById, ...keyBy(uploads, 'id') }
    const found = findPreset(input.presetId)
    const preset = found ?? getPreset(DEFAULT_PRESET_ID)
    if (!found) toast(`Model no longer available, switched to ${preset.title}`)
    const normalized = normalizeForPreset({ input, preset, uploads: cache }).input
    const duration = clampReferenceDuration({ input: normalized, uploads: cache, preset })
    set((state) => ({
      ...omit(normalized, 'prompt'),
      duration,
      prompts: { ...state.prompts, [input.tab]: input.prompt },
      uploadsById: cache,
    }))
  },
  reset: () => set({ ...defaults() }),
  normalizeLoaded: () => {
    const state = get()
    const preset = findPreset(state.presetId) ?? getPreset(DEFAULT_PRESET_ID)
    const { input } = normalizeForPreset({
      input: inputFromState(state),
      preset,
      uploads: state.uploadsById,
    })
    const duration = clampReferenceDuration({ input, uploads: state.uploadsById, preset })
    const { counts } = referenceSlots(input.references, (id) => state.uploadsById[id]?.kind)
    const references = canonicalizePrompt(state.prompts.references, counts)
    const next = omit({ ...input, duration, prompts: { ...state.prompts, references } }, 'prompt')
    if (!isEqual(pick(state, Object.keys(next)), next)) set(next)
  },
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
