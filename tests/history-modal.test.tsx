// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { HistoryModal } from '@/features/history/list/HistoryModal'

import { handleNoop, Observer, record } from './helpers/history'

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

const handleNavigate = vi.fn()

const baseProps = {
  open: true,
  hasMore: false,
  isLoadingMore: false,
  onNavigate: handleNavigate,
  onLoadMore: handleNoop,
  onOpenChange: handleNoop,
}

interface ModalParams {
  record: GenerationRecord | null
  selectedId: string
  viewOrder: string[]
  open?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  onOpenChange?: (open: boolean) => void
}

function modal(params: ModalParams) {
  return <HistoryModal {...baseProps} {...params} />
}

beforeEach(() => {
  handleNavigate.mockClear()
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('HistoryModal', () => {
  it('fills the window with a stage backdrop and wider details', () => {
    render(modal({ record: record('v'), selectedId: 'v', viewOrder: ['v'] }))

    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('max-w-450')
    expect(dialog.querySelector('.w-80')).not.toBeNull()

    const backdrop = dialog.querySelector('img.blur-3xl')

    expect(backdrop?.getAttribute('alt')).toBe('')
  })
})

describe('HistoryModal arrow keys', () => {
  it('moves to the next record with ArrowRight', () => {
    render(modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b', 'c'] }))

    fireEvent.keyDown(document.body, { key: 'ArrowRight' })

    expect(handleNavigate).toHaveBeenLastCalledWith('b')
  })

  it('moves to the previous record with ArrowLeft', () => {
    render(modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'] }))

    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })

    expect(handleNavigate).toHaveBeenLastCalledWith('a')
  })

  it('ignores arrow keys while closed', () => {
    render(modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'], open: false }))

    fireEvent.keyDown(document.body, { key: 'ArrowRight' })

    expect(handleNavigate).not.toHaveBeenCalled()
  })
})

describe('HistoryModal navigation', () => {
  it('moves to the next and previous record in order', () => {
    const { rerender } = render(
      modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b', 'c'] }),
    )

    fireEvent.click(screen.getByLabelText('Next'))

    expect(handleNavigate).toHaveBeenLastCalledWith('b')

    handleNavigate.mockClear()

    rerender(modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'] }))

    fireEvent.click(screen.getByLabelText('Previous'))

    expect(handleNavigate).toHaveBeenLastCalledWith('a')
  })

  it('disables previous on the first record and next on the last page', () => {
    const { rerender } = render(
      modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b'] }),
    )

    expect(screen.getByLabelText<HTMLButtonElement>('Previous').disabled).toBe(true)
    expect(screen.getByLabelText<HTMLButtonElement>('Next').disabled).toBe(false)

    rerender(modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b'] }))

    expect(screen.getByLabelText<HTMLButtonElement>('Previous').disabled).toBe(false)
    expect(screen.getByLabelText<HTMLButtonElement>('Next').disabled).toBe(true)
  })

  it('keeps next enabled on the last loaded record when more pages exist', () => {
    const handleLoadMore = vi.fn()

    render(
      modal({
        record: record('c'),
        selectedId: 'c',
        viewOrder: ['a', 'b', 'c'],
        hasMore: true,
        onLoadMore: handleLoadMore,
      }),
    )

    const next = screen.getByLabelText<HTMLButtonElement>('Next')

    expect(next.disabled).toBe(false)

    handleLoadMore.mockClear()
    fireEvent.click(next)

    expect(handleLoadMore).toHaveBeenCalledTimes(1)
  })
})

describe('HistoryModal active records', () => {
  it('shows a running record present in the view order without navigating', () => {
    render(
      modal({
        record: record('b', { status: 'in_progress' }),
        selectedId: 'b',
        viewOrder: ['a', 'b', 'c'],
      }),
    )

    expect(screen.getByText('Prompt b')).not.toBeNull()
    expect(handleNavigate).not.toHaveBeenCalled()
  })

  it('steps next and previous across completed, running and failed ids', () => {
    const { rerender } = render(
      modal({ record: record('a'), selectedId: 'a', viewOrder: ['a', 'b', 'c'] }),
    )

    fireEvent.click(screen.getByLabelText('Next'))

    expect(handleNavigate).toHaveBeenLastCalledWith('b')

    handleNavigate.mockClear()

    rerender(
      modal({
        record: record('b', { status: 'in_progress' }),
        selectedId: 'b',
        viewOrder: ['a', 'b', 'c'],
      }),
    )

    fireEvent.click(screen.getByLabelText('Next'))

    expect(handleNavigate).toHaveBeenLastCalledWith('c')

    handleNavigate.mockClear()

    rerender(
      modal({
        record: record('c', { status: 'failed' }),
        selectedId: 'c',
        viewOrder: ['a', 'b', 'c'],
      }),
    )

    fireEvent.click(screen.getByLabelText('Previous'))

    expect(handleNavigate).toHaveBeenLastCalledWith('b')
  })

  it('keeps a record selected when it turns completed and does not navigate', () => {
    const { rerender } = render(
      modal({
        record: record('b', { status: 'in_progress' }),
        selectedId: 'b',
        viewOrder: ['a', 'b', 'c'],
      }),
    )

    rerender(modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'] }))

    expect(handleNavigate).not.toHaveBeenCalled()
    expect(screen.getByText('Prompt b')).not.toBeNull()
  })
})

describe('HistoryModal recovery', () => {
  it('moves to the neighbor when the record drops out of order', () => {
    const { rerender } = render(
      modal({ record: record('b'), selectedId: 'b', viewOrder: ['a', 'b', 'c'] }),
    )

    handleNavigate.mockClear()

    rerender(modal({ record: null, selectedId: 'b', viewOrder: ['a', 'c'] }))

    expect(handleNavigate).toHaveBeenCalledWith('c')
  })

  it('closes when the last record is deleted', () => {
    const handleOpenChange = vi.fn()

    render(modal({ record: null, selectedId: 'b', viewOrder: [], onOpenChange: handleOpenChange }))

    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })
})
