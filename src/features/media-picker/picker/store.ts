'use client'

import { isEmpty, isNil } from 'lodash-es'
import { create } from 'zustand'

import { type KindExtensions } from '@/core/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media-types'
import type { PresetReferenceLimits } from '@/core/presets/types'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'

export type PickerCandidate = Pick<UploadItem, 'id' | 'kind'>

export interface PickerToggleMode {
  kind: 'toggle'
  useSelectedIds: () => string[]
  useUploadsById: () => UploadsById
  canAdd: (item: PickerCandidate) => string | null
  onToggle: (item: UploadItem) => void
}

export interface PickerPickMode {
  kind: 'pick'
  onPick: (item: UploadItem) => void
}

export type PickerMode = PickerToggleMode | PickerPickMode

export interface PickerRequest {
  id: number
  kinds: MediaKind[]
  extensions?: KindExtensions
  mode: PickerMode

  /** Region that keeps the picker open, not the clicked control. */
  anchor: HTMLElement | null
}

/** Picker extensions from preset reference formats, ignoring kinds without a list. */
export function extensionsFromLimits(
  limits: PresetReferenceLimits | undefined,
): KindExtensions | undefined {
  const entries = MEDIA_KINDS.flatMap((kind) => {
    const formats = limits?.[kind]?.formats

    if (isNil(formats) || formats.length === 0) {
      return []
    }

    return [[kind, formats] as const]
  })

  if (isEmpty(entries)) {
    return undefined
  }

  return Object.fromEntries(entries)
}

interface PickerInput extends Omit<PickerRequest, 'id' | 'anchor'> {
  anchor?: HTMLElement | null
}

interface MediaPickerState {
  request: PickerRequest | null
  open: (request: PickerInput) => void
  close: () => void
}

let nextId = 0

export const useMediaPickerStore = create<MediaPickerState>((set, get) => {
  return {
    request: null,
    open: (request) => {
      // An open picker keeps its request until it closes, so repeated openers are no-ops.
      if (!isNil(get().request)) {
        return
      }

      set({ request: { ...request, anchor: request.anchor ?? null, id: (nextId += 1) } })
    },
    close: () => {
      set({ request: null })
    },
  }
})

/** Opens the shared picker, keeping the current request when one is already open. */
export function openMediaPicker(request: PickerInput): void {
  useMediaPickerStore.getState().open(request)
}

/** Closes the picker without picking. */
export function closeMediaPicker(): void {
  useMediaPickerStore.getState().close()
}
