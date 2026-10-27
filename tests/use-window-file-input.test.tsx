// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGeneratorStore } from '@/features/generator/store/store'
import {
  useWindowFileInput,
  type UseWindowFileInputParams,
} from '@/features/media-input/use-window-file-input'
import {
  closeMediaPicker,
  openMediaPicker,
  type PickerToggleMode,
} from '@/features/media-picker/picker/store'

const png = new File(['png'], 'a.png', { type: 'image/png' })
const gif = new File(['gif'], 'b.gif', { type: 'image/gif' })

interface DragDataParams {
  files?: File[]
  types?: string[]
}

function dragData(params: DragDataParams = {}) {
  const files = params.files ?? []

  return {
    files,
    types: params.types ?? ['Files'],
  }
}

function pasteData(files: File[] = [], text = '') {
  return {
    files,
    getData: () => {
      return text
    },
  }
}

function Harness(props: UseWindowFileInputParams) {
  const { isDragging, hint } = useWindowFileInput(props)

  return (
    <>
      <span data-testid="state">{isDragging ? 'dragging' : 'idle'}</span>
      <span data-testid="hint">{hint}</span>
    </>
  )
}

function state(): string | null {
  return screen.getByTestId('state').textContent
}

function hint(): string | null {
  return screen.getByTestId('hint').textContent
}

function pickRequest() {
  return {
    kinds: ['image' as const],
    mode: { kind: 'pick' as const, onPick: vi.fn() },
  }
}

function toggleMode(): PickerToggleMode {
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
    onToggle: vi.fn(),
  }
}

beforeEach(() => {
  useGeneratorStore.setState({ tab: 'references' })
})

afterEach(() => {
  cleanup()
  closeMediaPicker()
})

describe('useWindowFileInput drag', () => {
  it('keeps dragging until the last nested leave', () => {
    render(<Harness onFiles={vi.fn()} />)

    fireEvent.dragEnter(window, { dataTransfer: dragData() })
    fireEvent.dragEnter(window, { dataTransfer: dragData() })

    expect(state()).toBe('dragging')

    fireEvent.dragLeave(window)

    expect(state()).toBe('dragging')

    fireEvent.dragLeave(window)

    expect(state()).toBe('idle')
  })

  it('ignores a drag without files', () => {
    render(<Harness onFiles={vi.fn()} />)

    fireEvent.dragEnter(window, { dataTransfer: dragData({ types: ['text/plain'] }) })

    expect(state()).toBe('idle')
  })

  it('calls the handler with dropped files', () => {
    const onFiles = vi.fn()

    render(<Harness onFiles={onFiles} />)

    fireEvent.dragEnter(window, { dataTransfer: dragData({ files: [png] }) })
    fireEvent.drop(window, { dataTransfer: dragData({ files: [png] }) })

    expect(onFiles).toHaveBeenCalledWith([png])
    expect(state()).toBe('idle')
  })
})

describe('useWindowFileInput paste', () => {
  it('calls the handler with pasted files', () => {
    const onFiles = vi.fn()

    render(<Harness onFiles={onFiles} />)

    fireEvent.paste(window, { clipboardData: pasteData([png, gif]) })

    expect(onFiles).toHaveBeenCalledWith([png, gif])
  })

  it('lets text through in an editable field', () => {
    const onFiles = vi.fn()

    render(
      <>
        <Harness onFiles={onFiles} />
        <textarea aria-label="prompt" />
      </>,
    )

    fireEvent.paste(screen.getByLabelText('prompt'), {
      clipboardData: pasteData([png], 'hello'),
    })

    expect(onFiles).not.toHaveBeenCalled()
  })

  it('ignores a text-only paste', () => {
    const onFiles = vi.fn()

    render(<Harness onFiles={onFiles} />)

    fireEvent.paste(window, { clipboardData: pasteData([], 'hello') })

    expect(onFiles).not.toHaveBeenCalled()
  })
})

describe('useWindowFileInput picker', () => {
  it('handles drag and paste while a picker request is open', () => {
    const onFiles = vi.fn()

    act(() => {
      openMediaPicker(pickRequest())
    })

    render(<Harness onFiles={onFiles} />)

    fireEvent.dragEnter(window, { dataTransfer: dragData({ files: [png] }) })
    fireEvent.drop(window, { dataTransfer: dragData({ files: [png] }) })
    fireEvent.paste(window, { clipboardData: pasteData([png]) })

    expect(state()).toBe('idle')
    expect(onFiles).toHaveBeenCalledTimes(2)
    expect(onFiles).toHaveBeenNthCalledWith(1, [png])
    expect(onFiles).toHaveBeenNthCalledWith(2, [png])
  })
})

describe('useWindowFileInput hint', () => {
  it('follows the generator tab while the picker is closed', () => {
    render(<Harness onFiles={vi.fn()} />)

    expect(hint()).toBe('as references')

    act(() => {
      useGeneratorStore.setState({ tab: 'frames' })
    })

    expect(hint()).toBe('as start frame')
  })

  it('follows the open picker mode', () => {
    render(<Harness onFiles={vi.fn()} />)

    act(() => {
      openMediaPicker({ kinds: ['image'], mode: toggleMode() })
    })

    expect(hint()).toBe('as references')

    act(() => {
      openMediaPicker(pickRequest())
    })

    expect(hint()).toBe('as start frame')
  })
})
