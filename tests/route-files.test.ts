// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPreset } from '@/core/presets'
import type { UploadItem } from '@/core/schemas/upload-item'
import { addBlockReason, referenceRoom } from '@/features/generator/reference-rules'
import { useGeneratorStore } from '@/features/generator/store/store'
import { routeFiles, routeUploads } from '@/features/media-input/route-files'
import {
  closeMediaPicker,
  openMediaPicker,
  type PickerCandidate,
  type PickerToggleMode,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'
import { uploadFiles } from '@/lib/api/uploads'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const toast = vi.hoisted(() => {
  return { skipped: vi.fn(), error: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast: Object.assign(toast.skipped, { error: toast.error }) }
})

vi.mock('@/lib/api/uploads', () => {
  return { uploadFiles: vi.fn() }
})

const png = new File(['png'], 'a.png', { type: 'image/png' })
const mp4 = new File(['mp4'], 'a.mp4', { type: 'video/mp4' })

const images = (count: number): UploadItem[] => {
  return Array.from({ length: count }, (_, index) => {
    return upload(`image-${index + 1}`, 'image')
  })
}

function canAdd(item: PickerCandidate): string | null {
  const state = useGeneratorStore.getState()
  const preset = getPreset(state.presetId)

  const room = referenceRoom({
    preset,
    references: state.references,
    uploadsById: state.uploadsById,
  })

  return addBlockReason({ kind: item.kind, room, preset })
}

function toggleMode(onToggle: PickerToggleMode['onToggle']): PickerToggleMode {
  return {
    kind: 'toggle',
    useSelectedIds: () => {
      return useGeneratorStore.getState().references
    },
    useUploadsById: () => {
      return useGeneratorStore.getState().uploadsById
    },
    canAdd,
    onToggle,
  }
}

function addReferences(item: UploadItem): void {
  useGeneratorStore.getState().addReferences([item])
}

beforeEach(() => {
  vi.clearAllMocks()
  closeMediaPicker()

  useGeneratorStore.setState({
    presetId: 'seedance-2.0',
    tab: 'references',
    references: [],
    frames: { start: null, end: null },
    uploadsById: {},
  })
})

afterEach(closeMediaPicker)

describe('routeFiles', () => {
  it('adds references within the preset limits', async () => {
    const existing = images(8)
    const added = upload('image-9', 'image')

    useGeneratorStore.setState({
      references: existing.map((item) => {
        return item.id
      }),
      uploadsById: uploadsOf(...existing),
    })

    vi.mocked(uploadFiles).mockResolvedValue([added])

    await routeFiles([png])

    expect(uploadFiles).toHaveBeenCalledWith([png])
    expect(useGeneratorStore.getState().references).toHaveLength(9)
    expect(useGeneratorStore.getState().references).toContain(added.id)
  })

  it('sets the start frame from an image in the frames tab', async () => {
    const frame = upload('frame-1', 'image')

    useGeneratorStore.setState({ tab: 'frames' })
    vi.mocked(uploadFiles).mockResolvedValue([frame])

    await routeFiles([png])

    expect(useGeneratorStore.getState().frames.start).toBe(frame.id)
  })

  it('skips videos in the frames tab with one toast', async () => {
    useGeneratorStore.setState({ tab: 'frames' })

    await routeFiles([mp4, mp4])

    expect(uploadFiles).not.toHaveBeenCalled()
    expect(useGeneratorStore.getState().frames.start).toBeNull()
    expect(toast.skipped).toHaveBeenCalledTimes(1)
    expect(toast.skipped).toHaveBeenCalledWith('Skipped 2 unsupported files')
  })
})

describe('routeFiles with a picker request', () => {
  it('toggles each new upload, keeps the picker open and skips over-limit files', async () => {
    const existing = images(8)
    const first = upload('image-9', 'image')
    const second = upload('image-10', 'image')
    const added = [first, second]
    const onToggle = vi.fn(addReferences)

    useGeneratorStore.setState({
      references: existing.map((item) => {
        return item.id
      }),
      uploadsById: uploadsOf(...existing),
    })

    vi.mocked(uploadFiles).mockResolvedValue(added)

    openMediaPicker({ openerKey: 'test', kinds: ['image'], mode: toggleMode(onToggle) })

    await routeFiles([png, png])

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(first)
    expect(useGeneratorStore.getState().references).toContain(first.id)
    expect(useGeneratorStore.getState().references).not.toContain(second.id)
    expect(useMediaPickerStore.getState().request).not.toBeNull()
    expect(toast.skipped).toHaveBeenCalledTimes(1)
    expect(toast.skipped).toHaveBeenCalledWith('Skipped 1 file (Reference limit reached)')
  })

  it('picks the first upload and closes the picker', async () => {
    const first = upload('image-1', 'image')
    const second = upload('image-2', 'image')
    const onPick = vi.fn()

    vi.mocked(uploadFiles).mockResolvedValue([first, second])
    openMediaPicker({ openerKey: 'test', kinds: ['image'], mode: { kind: 'pick', onPick } })

    await routeFiles([png])

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(first)
    expect(useMediaPickerStore.getState().request).toBeNull()
    expect(toast.skipped).not.toHaveBeenCalled()
  })

  it('skips unsupported files with one toast', async () => {
    openMediaPicker({
      openerKey: 'test',
      kinds: ['image'],
      mode: { kind: 'pick', onPick: vi.fn() },
    })

    await routeFiles([mp4])

    expect(uploadFiles).not.toHaveBeenCalled()
    expect(useMediaPickerStore.getState().request).not.toBeNull()
    expect(toast.skipped).toHaveBeenCalledTimes(1)
    expect(toast.skipped).toHaveBeenCalledWith('Skipped 1 file (unsupported file)')
  })
})

describe('routeUploads', () => {
  it('routes prepared items into the active tab without uploading again', () => {
    const item = upload('prepared', 'image')

    routeUploads([item])

    expect(useGeneratorStore.getState().references).toContain(item.id)
    expect(uploadFiles).not.toHaveBeenCalled()
  })
})
