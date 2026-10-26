// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import {
  closeMediaPicker,
  openMediaPicker,
  type PickerCandidate,
  type PickerPickMode,
  type PickerToggleMode,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'
import { UploadsTab } from '@/features/media-picker/uploads/UploadsTab'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    fetchUploads: vi.fn(),
  }
})

vi.mock('@/lib/api/uploads', () => {
  return {
    fetchUploads: mocks.fetchUploads,
    deleteUpload: vi.fn(),
  }
})

const items = [upload('a', 'image'), upload('b', 'image')]

vi.mock('swr', () => {
  return {
    default: () => {
      return {
        data: items,
        isLoading: false,
        mutate: vi.fn(),
      }
    },
  }
})

afterEach(() => {
  cleanup()
  closeMediaPicker()
})

function toggleMode(params: {
  selectedIds: string[]
  canAdd: (item: PickerCandidate) => string | null
  onToggle: (item: UploadItem) => void
}): PickerToggleMode {
  return {
    kind: 'toggle',
    useSelectedIds: () => {
      return params.selectedIds
    },
    useUploadsById: () => {
      return uploadsOf(...items)
    },
    canAdd: params.canAdd,
    onToggle: params.onToggle,
  }
}

describe('picker request modes', () => {
  it('toggles an upload click and shows the store selection', () => {
    const onToggle = vi.fn<(item: UploadItem) => void>()

    const mode = toggleMode({
      selectedIds: ['a'],
      canAdd: () => {
        return null
      },
      onToggle,
    })

    render(<UploadsTab kinds={['image']} mode={mode} onUploaded={vi.fn()} />)

    const selected = screen.getByRole('button', { name: 'a.png' })
    const other = screen.getByRole('button', { name: 'b.png' })

    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(other.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(other)

    expect(onToggle).toHaveBeenCalledWith(items[1])
  })

  it('disables an unselected upload and shows the reason', async () => {
    const mode = toggleMode({
      selectedIds: [],
      canAdd: () => {
        return 'Reference limit reached'
      },
      onToggle: vi.fn<(item: UploadItem) => void>(),
    })

    render(<UploadsTab kinds={['image']} mode={mode} onUploaded={vi.fn()} />)

    const tile = screen.getByRole('button', { name: 'a.png' })

    expect((tile as HTMLButtonElement).disabled).toBe(true)

    fireEvent.focus(tile)

    const tooltip = await screen.findByRole('tooltip')

    expect(tooltip.textContent).toBe('Reference limit reached')
  })

  it('picks an upload and closes the picker in pick mode', () => {
    const onPick = vi.fn<(item: UploadItem) => void>()
    const mode: PickerPickMode = { kind: 'pick', onPick }

    openMediaPicker({ kinds: ['image'], mode })

    render(<UploadsTab kinds={['image']} mode={mode} onUploaded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'a.png' }))

    expect(onPick).toHaveBeenCalledWith(items[0])
    expect(useMediaPickerStore.getState().request).toBeNull()
  })
})
