// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

beforeEach(() => {
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
    render(
      <HistoryModal
        record={record('v')}
        open
        selectedId="v"
        order={['v']}
        hasMore={false}
        isLoadingMore={false}
        onNavigate={handleNoop}
        onLoadMore={handleNoop}
        onOpenChange={handleNoop}
      />,
    )

    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('max-w-450')
    expect(dialog.querySelector('.w-80')).not.toBeNull()

    const backdrop = dialog.querySelector('img.blur-3xl')

    expect(backdrop?.getAttribute('alt')).toBe('')
  })
})

describe('HistoryModal arrow keys', () => {
  it('moves to the next record with ArrowRight', () => {
    const handleNavigate = vi.fn()

    render(
      <HistoryModal
        record={record('a')}
        open
        selectedId="a"
        order={['a', 'b', 'c']}
        hasMore={false}
        isLoadingMore={false}
        onNavigate={handleNavigate}
        onLoadMore={handleNoop}
        onOpenChange={handleNoop}
      />,
    )

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(handleNavigate).toHaveBeenLastCalledWith('b')
  })

  it('moves to the previous record with ArrowLeft', () => {
    const handleNavigate = vi.fn()

    render(
      <HistoryModal
        record={record('b')}
        open
        selectedId="b"
        order={['a', 'b', 'c']}
        hasMore={false}
        isLoadingMore={false}
        onNavigate={handleNavigate}
        onLoadMore={handleNoop}
        onOpenChange={handleNoop}
      />,
    )

    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    expect(handleNavigate).toHaveBeenLastCalledWith('a')
  })

  it('ignores arrow keys while closed', () => {
    const handleNavigate = vi.fn()

    render(
      <HistoryModal
        record={record('b')}
        open={false}
        selectedId="b"
        order={['a', 'b', 'c']}
        hasMore={false}
        isLoadingMore={false}
        onNavigate={handleNavigate}
        onLoadMore={handleNoop}
        onOpenChange={handleNoop}
      />,
    )

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(handleNavigate).not.toHaveBeenCalled()
  })
})

describe('HistoryModal navigation', () => {
  it('moves to the next and previous record in order', () => {
    const handleNavigate = vi.fn()

    const navProps = {
      order: ['a', 'b', 'c'],
      hasMore: false,
      isLoadingMore: false,
      onNavigate: handleNavigate,
      onLoadMore: handleNoop,
      onOpenChange: handleNoop,
    }

    const { rerender } = render(
      <HistoryModal {...navProps} record={record('a')} open selectedId="a" />,
    )

    fireEvent.click(screen.getByLabelText('Next'))

    expect(handleNavigate).toHaveBeenLastCalledWith('b')

    handleNavigate.mockClear()

    rerender(<HistoryModal {...navProps} record={record('b')} open selectedId="b" />)

    fireEvent.click(screen.getByLabelText('Previous'))

    expect(handleNavigate).toHaveBeenLastCalledWith('a')
  })

  it('disables previous on the first record and next on the last page', () => {
    const navProps = {
      order: ['a', 'b'],
      hasMore: false,
      isLoadingMore: false,
      onNavigate: handleNoop,
      onLoadMore: handleNoop,
      onOpenChange: handleNoop,
    }

    const { rerender } = render(
      <HistoryModal {...navProps} record={record('a')} open selectedId="a" />,
    )

    expect(screen.getByLabelText<HTMLButtonElement>('Previous').disabled).toBe(true)
    expect(screen.getByLabelText<HTMLButtonElement>('Next').disabled).toBe(false)

    rerender(<HistoryModal {...navProps} record={record('b')} open selectedId="b" />)

    expect(screen.getByLabelText<HTMLButtonElement>('Previous').disabled).toBe(false)
    expect(screen.getByLabelText<HTMLButtonElement>('Next').disabled).toBe(true)
  })

  it('keeps next enabled on the last loaded record when more pages exist', () => {
    const handleLoadMore = vi.fn()

    render(
      <HistoryModal
        record={record('c')}
        open
        selectedId="c"
        order={['a', 'b', 'c']}
        hasMore
        isLoadingMore={false}
        onNavigate={handleNoop}
        onLoadMore={handleLoadMore}
        onOpenChange={handleNoop}
      />,
    )

    const next = screen.getByLabelText<HTMLButtonElement>('Next')

    expect(next.disabled).toBe(false)

    handleLoadMore.mockClear()
    fireEvent.click(next)

    expect(handleLoadMore).toHaveBeenCalledTimes(1)
  })
})

describe('HistoryModal recovery', () => {
  it('moves to the neighbor when the record drops out of order', () => {
    const handleNavigate = vi.fn()

    const navProps = {
      hasMore: false,
      isLoadingMore: false,
      onNavigate: handleNavigate,
      onLoadMore: handleNoop,
      onOpenChange: handleNoop,
    }

    const { rerender } = render(
      <HistoryModal
        {...navProps}
        record={record('b')}
        open
        selectedId="b"
        order={['a', 'b', 'c']}
      />,
    )

    handleNavigate.mockClear()

    rerender(<HistoryModal {...navProps} record={null} open selectedId="b" order={['a', 'c']} />)

    expect(handleNavigate).toHaveBeenCalledWith('c')
  })

  it('closes when the last record is deleted', () => {
    const handleOpenChange = vi.fn()

    render(
      <HistoryModal
        record={null}
        open
        selectedId="b"
        order={[]}
        hasMore={false}
        isLoadingMore={false}
        onNavigate={handleNoop}
        onLoadMore={handleNoop}
        onOpenChange={handleOpenChange}
      />,
    )

    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })
})
