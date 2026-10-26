// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import { FolderTab } from '@/features/media-picker/folders/FolderTab'
import type { PickerMode } from '@/features/media-picker/picker/store'
import { closePreview, usePreviewStore } from '@/features/preview/preview-store'

import { upload } from './helpers/validation-fixtures'

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

vi.mock('@/lib/api/uploads', () => {
  return {
    linkFolderFile: mocks.linkFolderFile,
  }
})

vi.mock('@/lib/api/media-urls', () => {
  return {
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
          files: [
            { name: 'clip.mp4', rel: 'clip.mp4', kind: 'video', sizeBytes: 1, mtimeMs: 1 },
            { name: 'second.mp4', rel: 'second.mp4', kind: 'video', sizeBytes: 1, mtimeMs: 1 },
          ],
        },
        isLoading: false,
      }
    },
  }
})

afterEach(() => {
  cleanup()
  closePreview()
  mocks.fetchFolderFiles.mockReset()
  mocks.linkFolderFile.mockReset()
})

function toggleMode(onToggle: (item: UploadItem) => void): PickerMode {
  return {
    kind: 'toggle',
    useSelectedIds: () => {
      return []
    },
    useUploadsById: () => {
      return {}
    },
    canAdd: () => {
      return null
    },
    onToggle,
  }
}

interface RenderTabParams {
  mode: PickerMode
}

function renderTab(params: RenderTabParams) {
  const handleNavigate = vi.fn()

  render(
    <FolderTab
      folderId="folder-1"
      folderName="Folder"
      kinds={['video']}
      sub=""
      mode={params.mode}
      onNavigate={handleNavigate}
    />,
  )

  return { onNavigate: handleNavigate }
}

describe('FolderTab selection', () => {
  it('links the file and toggles it in toggle mode', async () => {
    const linked = upload('linked', 'video')

    mocks.linkFolderFile.mockResolvedValue(linked)

    const onToggle = vi.fn<(item: UploadItem) => void>()

    renderTab({ mode: toggleMode(onToggle) })

    fireEvent.click(screen.getByRole('button', { name: 'Select clip.mp4' }))

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(linked)
    })

    expect(mocks.linkFolderFile).toHaveBeenCalledWith({
      folderId: 'folder-1',
      relPath: 'clip.mp4',
    })
  })

  it('opens the folder preview without linking', () => {
    renderTab({ mode: toggleMode(vi.fn<(item: UploadItem) => void>()) })

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))

    expect(mocks.linkFolderFile).not.toHaveBeenCalled()

    const request = usePreviewStore.getState().request
    const item = request?.items[0]

    if (isNil(request) || isNil(item)) {
      throw new Error('preview request missing')
    }

    expect(item.id).toBe('folder:folder-1:clip.mp4')
    expect(item.previewRef).toBe('folders/folder-1/clip.mp4')
    expect(item.mime).toBe('video/mp4')
  })

  it('chains every filtered file and opens at the clicked index', () => {
    renderTab({ mode: toggleMode(vi.fn<(item: UploadItem) => void>()) })

    fireEvent.click(screen.getByRole('button', { name: 'Preview second.mp4' }))

    const request = usePreviewStore.getState().request

    if (isNil(request)) {
      throw new Error('preview request missing')
    }

    expect(
      request.items.map((item) => {
        return item.id
      }),
    ).toEqual(['folder:folder-1:clip.mp4', 'folder:folder-1:second.mp4'])

    expect(request.index).toBe(1)
  })

  it('routes preview select through the link helper and keeps the preview open', async () => {
    const linked = upload('linked', 'video')

    mocks.linkFolderFile.mockResolvedValue(linked)

    const onToggle = vi.fn<(item: UploadItem) => void>()

    renderTab({ mode: toggleMode(onToggle) })

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))

    const request = usePreviewStore.getState().request
    const item = request?.items[0]

    if (isNil(request) || isNil(item)) {
      throw new Error('preview request missing')
    }

    act(() => {
      return request.actions?.select?.(item)
    })

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(linked)
    })

    expect(usePreviewStore.getState().request).not.toBeNull()
  })

  it('links and picks the file in pick mode', async () => {
    const linked = upload('linked', 'video')

    mocks.linkFolderFile.mockResolvedValue(linked)

    const onPick = vi.fn<(item: UploadItem) => void>()

    renderTab({ mode: { kind: 'pick', onPick } })

    fireEvent.click(screen.getByRole('button', { name: 'Select clip.mp4' }))

    await waitFor(() => {
      expect(onPick).toHaveBeenCalledWith(linked)
    })

    expect(mocks.linkFolderFile).toHaveBeenCalledWith({
      folderId: 'folder-1',
      relPath: 'clip.mp4',
    })
  })
})
