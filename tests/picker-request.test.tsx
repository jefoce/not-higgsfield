// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReferencesBox } from '@/features/generator/references/ReferencesBox'
import { useGeneratorStore } from '@/features/generator/store/store'
import { MediaPicker } from '@/features/media-picker/picker/MediaPicker'
import {
  closeMediaPicker,
  openMediaPicker,
  type PickerPickMode,
  type PickerRequest,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'

const mocks = vi.hoisted(() => {
  return { useMediaQuery: vi.fn() }
})

vi.mock('@/lib/use-media-query', () => {
  return { useMediaQuery: mocks.useMediaQuery }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function pickMode(): PickerPickMode {
  return { kind: 'pick', onPick: vi.fn() }
}

function currentRequest(): PickerRequest | null {
  return useMediaPickerStore.getState().request
}

beforeEach(() => {
  mocks.useMediaQuery.mockReturnValue(true)
  vi.stubGlobal('ResizeObserver', Observer)

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    references: [],
    uploadsById: {},
    frames: { start: null, end: null },
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  closeMediaPicker()
  mocks.useMediaQuery.mockReset()
  vi.unstubAllGlobals()
})

describe('picker request reuse', () => {
  it('keeps the first id, items, mode and anchor when opened again', () => {
    const anchor = document.createElement('div')
    const mode = pickMode()

    openMediaPicker({ kinds: ['image'], mode, anchor })

    const first = currentRequest()

    openMediaPicker({
      kinds: ['video', 'audio'],
      mode: pickMode(),
      anchor: document.createElement('button'),
    })

    const current = currentRequest()

    expect(current?.id).toBe(first?.id)
    expect(current?.kinds).toEqual(['image'])
    expect(current?.mode).toBe(mode)
    expect(current?.anchor).toBe(anchor)
  })

  it('creates a new request after the picker closes', () => {
    openMediaPicker({ kinds: ['image'], mode: pickMode() })

    const firstId = currentRequest()?.id

    closeMediaPicker()
    openMediaPicker({ kinds: ['image'], mode: pickMode() })

    expect(currentRequest()?.id).not.toBe(firstId)
  })

  it('keeps the rendered body when the add control is clicked again', async () => {
    render(
      <>
        <ReferencesBox />
        <MediaPicker />
      </>,
    )

    const add = screen.getByRole('button', { name: /^Add references/ })

    fireEvent.click(add)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    const body = screen.getByRole('button', { name: 'Uploads' })
    const id = currentRequest()?.id

    fireEvent.click(add)

    expect(currentRequest()?.id).toBe(id)
    expect(screen.getByRole('button', { name: 'Uploads' })).toBe(body)
  })
})
