// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FolderTab } from '@/features/media-picker/folders/FolderTab'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import { closePreview, usePreviewStore } from '@/features/preview/preview-store'

const mocks = vi.hoisted(() => {
  return {
    fetchFolderFiles: vi.fn(),
    linkFolderFile: vi.fn(),
  }
})

vi.mock('@/lib/api/folders', () => {
  return {
    fetchFolderFiles: mocks.fetchFolderFiles,
    linkFolderFile: mocks.linkFolderFile,
  }
})

vi.mock('@/lib/api/media-urls', () => {
  return {
    mediaUrl: () => {
      return '/media'
    },
    thumbUrl: () => {
      return '/thumb'
    },
  }
})

vi.mock('swr', () => {
  return {
    default: () => {
      return {
        data: {
          path: '',
          dirs: [],
          files: [{ name: 'clip.mp4', rel: 'clip.mp4', kind: 'video', sizeBytes: 1, mtimeMs: 1 }],
        },
        isLoading: false,
      }
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => {
      return Promise.resolve()
    },
  })

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  closePreview()
  vi.unstubAllGlobals()
  mocks.fetchFolderFiles.mockReset()
  mocks.linkFolderFile.mockReset()
})

interface RenderPreviewParams {
  max: number
  selectedRels: string[]
  onPickFile: (rel: string) => void
  onToggleFile: (rel: string) => void
}

function renderPreview(params: RenderPreviewParams) {
  const { max, selectedRels, onPickFile, onToggleFile } = params

  return render(
    <>
      <FolderTab
        folderId="folder-1"
        folderName="Folder"
        kinds={['video']}
        max={max}
        sub=""
        selectedRels={selectedRels}
        onPickFile={onPickFile}
        onNavigate={vi.fn<(sub: string) => void>()}
        onToggleFile={onToggleFile}
      />
      <MediaPreviewModal />
    </>,
  )
}

interface PreviewHostProps {
  initialRels: string[]
  max: number
  onPickFile: (rel: string) => void
}

/** Stateful host so the opener selection updates like the real folder browse. */
function PreviewHost(props: PreviewHostProps) {
  const { initialRels, max, onPickFile } = props
  const [selectedRels, setSelectedRels] = useState(initialRels)

  const handleToggleFile = (rel: string): void => {
    setSelectedRels((previous) => {
      if (previous.includes(rel)) {
        return previous.filter((entry) => {
          return entry !== rel
        })
      }

      return [...previous, rel]
    })
  }

  return (
    <>
      <FolderTab
        folderId="folder-1"
        folderName="Folder"
        kinds={['video']}
        max={max}
        sub=""
        selectedRels={selectedRels}
        onPickFile={onPickFile}
        onNavigate={vi.fn<(sub: string) => void>()}
        onToggleFile={handleToggleFile}
      />
      <MediaPreviewModal />
    </>
  )
}

describe('FolderTab preview selection', () => {
  it('flips the label right after a deselect against live selection', () => {
    render(
      <PreviewHost
        initialRels={['clip.mp4']}
        max={3}
        onPickFile={vi.fn<(rel: string) => void>()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deselect' }))

    expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('deselects from the preview, flips the label after refresh and stays open', () => {
    const handlePickFile = vi.fn<(rel: string) => void>()
    const handleToggleFile = vi.fn<(rel: string) => void>()

    const view = renderPreview({
      max: 3,
      selectedRels: ['clip.mp4'],
      onPickFile: handlePickFile,
      onToggleFile: handleToggleFile,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Deselect' }))

    expect(handleToggleFile).toHaveBeenCalledWith('clip.mp4')
    expect(screen.getByRole('dialog')).toBeTruthy()

    view.rerender(
      <>
        <FolderTab
          folderId="folder-1"
          folderName="Folder"
          kinds={['video']}
          max={3}
          sub=""
          selectedRels={[]}
          onPickFile={handlePickFile}
          onNavigate={vi.fn<(sub: string) => void>()}
          onToggleFile={handleToggleFile}
        />
        <MediaPreviewModal />
      </>,
    )

    act(() => {
      usePreviewStore.getState().refresh()
    })

    expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Deselect' })).toBeNull()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes the preview when only one pick is allowed', async () => {
    const handlePickFile = vi.fn<(rel: string) => void>()

    renderPreview({
      max: 1,
      selectedRels: [],
      onPickFile: handlePickFile,
      onToggleFile: vi.fn<(rel: string) => void>(),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(handlePickFile).toHaveBeenCalledWith('clip.mp4')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
