// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LazyVideo } from '@/features/player/LazyVideo'
import { getSnapshot, release } from '@/features/player/player-slots'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import { closePreview, openPreview } from '@/features/preview/preview-store'

import { upload } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    playAudio: vi.fn<(src: string) => void>(),
    pauseAudio: vi.fn(),
    currentSrc: vi.fn<() => string>(),
    toastError: vi.fn(),
  }
})

let current = ''

vi.mock('@/lib/audio-player', () => {
  return {
    playAudio: mocks.playAudio,
    pauseAudio: mocks.pauseAudio,
    seekAudio: vi.fn(),
    currentSrc: mocks.currentSrc,
    currentDuration: () => {
      return 0
    },
    useAudioPlaying: () => {
      return false
    },
    useAudioTime: () => {
      return null
    },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: mocks.toastError } }
})

const play = vi.fn(() => {
  return Promise.resolve()
})

const pause = vi.fn()
const load = vi.fn()

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderModal(): void {
  render(<MediaPreviewModal />)
}

beforeEach(() => {
  current = ''
  mocks.playAudio.mockReset()

  mocks.playAudio.mockImplementation((src) => {
    current = src
  })

  mocks.pauseAudio.mockReset()
  mocks.currentSrc.mockReset()

  mocks.currentSrc.mockImplementation(() => {
    return current
  })

  mocks.toastError.mockReset()
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: load })
})

afterEach(() => {
  cleanup()
  closePreview()
  document.body.replaceChildren()

  for (const id of getSnapshot()) {
    release(id)
  }

  play.mockClear()
  pause.mockClear()
  vi.unstubAllGlobals()
})

describe('preview autoplay', () => {
  it('plays a video item on open', async () => {
    renderModal()

    act(() => {
      openPreview({ items: [upload('clip', 'video')], index: 0 })
    })

    await waitFor(() => {
      expect(play).toHaveBeenCalled()
    })

    expect(screen.getByRole('dialog').querySelector('video')).not.toBeNull()
  })

  it('plays an audio item and pauses it when switching to a video', async () => {
    renderModal()

    act(() => {
      openPreview({ items: [upload('track', 'audio'), upload('clip', 'video')], index: 0 })
    })

    expect(mocks.playAudio).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Next'))

    await waitFor(() => {
      expect(mocks.pauseAudio).toHaveBeenCalled()
      expect(play).toHaveBeenCalled()
    })
  })

  it('pauses audio when the preview closes', async () => {
    renderModal()

    act(() => {
      openPreview({ items: [upload('track', 'audio')], index: 0 })
    })

    expect(mocks.playAudio).toHaveBeenCalledTimes(1)

    act(() => {
      closePreview()
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    expect(mocks.pauseAudio).toHaveBeenCalled()
  })

  it('keeps the play button and shows no toast when autoplay is rejected', async () => {
    play.mockImplementationOnce(() => {
      return Promise.reject(new Error('blocked'))
    })

    const { container } = render(<LazyVideo id="rejected" src="/blocked.mp4" autoPlay />)

    await waitFor(() => {
      expect(play).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(container.querySelector('button[aria-label="Play"]')).not.toBeNull()
    })

    expect(mocks.toastError).not.toHaveBeenCalled()
  })
})
