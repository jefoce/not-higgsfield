// @vitest-environment jsdom
import { useRef } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DockedPanel } from '@/ui/DockedPanel'

const mocks = vi.hoisted(() => {
  return {
    useMediaQuery: vi.fn(),
  }
})

vi.mock('@/lib/use-media-query', () => {
  return {
    useMediaQuery: mocks.useMediaQuery,
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ANCHOR_RECT = {
  width: 600,
  height: 640,
  top: 0,
  left: 0,
  right: 600,
  bottom: 640,
  x: 0,
  y: 0,
  toJSON: () => {
    return {}
  },
}

interface HarnessProps {
  onOpenChange: (isOpen: boolean) => void
}

function Harness(props: HarnessProps) {
  const anchorRef = useRef<HTMLElement>(null)

  return (
    <>
      <aside ref={anchorRef}>
        <button type="button">Generate</button>
      </aside>
      <button type="button">History</button>
      <DockedPanel
        open
        onOpenChange={props.onOpenChange}
        anchorRef={anchorRef}
        label="Choose media"
      >
        <p>Picker body</p>
      </DockedPanel>
    </>
  )
}

function renderPanel() {
  const onOpenChange = vi.fn()

  render(<Harness onOpenChange={onOpenChange} />)

  return { onOpenChange }
}

async function settleDismissableLayer(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

beforeEach(() => {
  mocks.useMediaQuery.mockReturnValue(true)
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  mocks.useMediaQuery.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('DockedPanel wide branch', () => {
  it('docks beside the anchor at wide widths with the anchor size', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(ANCHOR_RECT)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800)
    renderPanel()

    const dialog = screen.getByRole('dialog')

    await waitFor(() => {
      expect(dialog.style.width).toBe('184px')
    })

    expect(dialog.style.height).toBe('640px')
    expect(dialog.parentElement?.dataset.radixPopperContentWrapper).toBe('')
    expect(dialog.className).toContain('backdrop-blur-xl')
  })

  it('stays open when the pointer goes down inside the anchor', async () => {
    const { onOpenChange } = renderPanel()

    await settleDismissableLayer()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Generate' }), { button: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await settleDismissableLayer()

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes when the pointer goes down outside the anchor', async () => {
    const { onOpenChange } = renderPanel()

    await settleDismissableLayer()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'History' }), { button: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'History' }))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})

describe('DockedPanel narrow branch', () => {
  it('falls back to the centered modal below 900 px', () => {
    mocks.useMediaQuery.mockReturnValue(false)
    renderPanel()

    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('h-[min(720px,85vh)]')
    expect(dialog.className).toContain('w-[min(900px,90vw)]')
    expect(document.querySelector('[data-radix-popper-content-wrapper]')).toBeNull()
  })
})
