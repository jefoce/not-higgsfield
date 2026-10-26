// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { focusGenerator } from '@/features/generator/focus-generator'
import { useGeneratorStore } from '@/features/generator/store/store'
import { DetailsPanel } from '@/features/history/details/DetailsPanel'
import { closePreview, openPreview, usePreviewStore } from '@/features/preview/preview-store'

import { Observer, record } from './helpers/history'
import { required } from './helpers/required'
import { upload, uploadsOf } from './helpers/validation-fixtures'

const linkGenerationFile = vi.hoisted(() => {
  return vi.fn()
})

const captureGenerationFrame = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/lib/fetcher', () => {
  return {
    apiPost: vi.fn(),
    apiDelete: vi.fn(),
    apiPatch: vi.fn(),
    fetcher: vi.fn(),
    ApiError: class ApiError extends Error {
      status = 0
    },
  }
})

vi.mock('@/lib/platform', () => {
  return {
    platform: { confirm: vi.fn(), saveVideo: vi.fn(), saveVideos: vi.fn() },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

vi.mock('@/features/generator/focus-generator', () => {
  return { focusGenerator: vi.fn() }
})

vi.mock('@/lib/api/uploads', async (importOriginal) => {
  const actual = await importOriginal<{ linkGenerationFile: typeof linkGenerationFile }>()

  return { ...actual, linkGenerationFile }
})

vi.mock('@/lib/api/generations', async (importOriginal) => {
  const actual = await importOriginal<{ captureGenerationFrame: typeof captureGenerationFrame }>()

  return { ...actual, captureGenerationFrame }
})

const RECORD_ID = 'v'
const linkedVideo = upload('linked', 'video')
const lastFrame = upload('last-frame', 'image')
const handleApplied = vi.fn()

function panel(onApplied?: () => void) {
  return <DetailsPanel record={record(RECORD_ID)} onApplied={onApplied} />
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  vi.clearAllMocks()
  linkGenerationFile.mockReset()
  linkGenerationFile.mockResolvedValue(linkedVideo)
  captureGenerationFrame.mockReset()
  captureGenerationFrame.mockResolvedValue(lastFrame)

  useGeneratorStore.setState({
    presetId: 'seedance-2.0',
    tab: 'references',
    prompts: { frames: '', references: '' },
    frames: { start: null, end: null },
    references: [],
    uploadsById: {},
  })

  closePreview()
})

afterEach(() => {
  cleanup()
  closePreview()
  vi.unstubAllGlobals()
})

describe('details reference button', () => {
  it('adds the video as a reference, closes the preview and reports the apply', async () => {
    openPreview({ items: [linkedVideo], index: 0 })
    render(panel(handleApplied))

    fireEvent.click(screen.getByRole('button', { name: 'Reference' }))

    await waitFor(() => {
      expect(linkGenerationFile).toHaveBeenCalledWith({ generationId: RECORD_ID })
    })

    await waitFor(() => {
      expect(useGeneratorStore.getState().references).toEqual(['linked'])
    })

    expect(handleApplied).toHaveBeenCalledTimes(1)
    expect(focusGenerator).toHaveBeenCalledTimes(1)
    expect(usePreviewStore.getState().request).toBeNull()
  })

  it('captures the last frame on the frames tab', async () => {
    useGeneratorStore.setState({ tab: 'frames' })
    render(panel(handleApplied))

    fireEvent.click(screen.getByRole('button', { name: 'Reference' }))

    await waitFor(() => {
      expect(captureGenerationFrame).toHaveBeenCalledWith(RECORD_ID, 'last')
    })

    await waitFor(() => {
      expect(useGeneratorStore.getState().frames.start).toBe('last-frame')
    })

    expect(handleApplied).toHaveBeenCalledTimes(1)
  })

  it('keeps the modal and the preview open when the link fails', async () => {
    linkGenerationFile.mockRejectedValueOnce(new Error('offline'))
    openPreview({ items: [linkedVideo], index: 0 })
    render(panel(handleApplied))

    fireEvent.click(screen.getByRole('button', { name: 'Reference' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('offline')
    })

    expect(handleApplied).not.toHaveBeenCalled()
    expect(usePreviewStore.getState().request).not.toBeNull()
  })

  it('disables the button and explains a full reference list', async () => {
    const videos = [upload('r1', 'video'), upload('r2', 'video'), upload('r3', 'video')]

    useGeneratorStore.setState({
      references: videos.map((item) => {
        return item.id
      }),
      uploadsById: uploadsOf(...videos),
    })

    render(panel(handleApplied))

    const button = screen.getByRole('button', { name: 'Reference' })

    expect((button as HTMLButtonElement).disabled).toBe(true)

    fireEvent.pointerMove(required(button.parentElement, 'tooltip wrapper'))

    const tooltip = await screen.findByRole('tooltip')

    expect(tooltip.textContent).toBe('Reference limit reached')
  })

  it('applies without an onApplied callback', async () => {
    render(panel())

    fireEvent.click(screen.getByRole('button', { name: 'Reference' }))

    await waitFor(() => {
      expect(useGeneratorStore.getState().references).toEqual(['linked'])
    })

    expect(focusGenerator).toHaveBeenCalledTimes(1)
  })

  it('closes the modal after Reuse loads the draft', async () => {
    render(panel(handleApplied))

    fireEvent.click(screen.getByRole('button', { name: 'Reuse' }))

    await waitFor(() => {
      expect(handleApplied).toHaveBeenCalledTimes(1)
    })
  })
})
