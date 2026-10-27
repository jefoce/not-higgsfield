// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import { useGeneratorStore } from '@/features/generator/store/store'
import { routeFiles } from '@/features/media-input/route-files'
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

beforeEach(() => {
  vi.clearAllMocks()

  useGeneratorStore.setState({
    presetId: 'seedance-2.0',
    tab: 'references',
    references: [],
    frames: { start: null, end: null },
    uploadsById: {},
  })
})

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
