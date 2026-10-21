// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HistoryGrid } from '@/features/history/HistoryGrid'
import { HistoryRow } from '@/features/history/HistoryRow'
import { SelectionBar } from '@/features/history/SelectionBar'
import { useSelectionStore } from '@/features/history/selection-store'
import type { GenerationRecord } from '@/core/types'

const apiPost = vi.hoisted(() => vi.fn())

vi.mock('@/lib/fetcher', () => ({
  apiPost,
  apiPatch: vi.fn(),
  fetcher: vi.fn(),
  ApiError: class ApiError extends Error {
    status = 0
  },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

class Observer {
  observe() {}
  disconnect() {}
}

function record(id: string): GenerationRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    input: {
      presetId: 'seedance-2.0',
      tab: 'references',
      prompt: `Prompt ${id}`,
      audio: true,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '1080p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'seedance-2.0', title: 'Seedance', slug: 'seedance' },
    inputsSnapshot: {},
    seedUsed: 1,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: 0,
      isByok: false,
      billed: true,
    },
    output: { video: `${id}.mp4`, preview: `${id}.preview.png` },
  }
}

const ids = () => [...useSelectionStore.getState().ids]
const setSelection = (list: string[]) => act(() => useSelectionStore.getState().setMany(list, true))

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  useSelectionStore.getState().clear()
  apiPost.mockReset()
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  vi.unstubAllGlobals()
})

describe('history selection', () => {
  it('does not render a check icon while unselected', () => {
    useSelectionStore.getState().setOrder(['a'])
    render(<HistoryGrid records={[record('a')]} onOpen={() => {}} />)

    const box = screen.getByRole('checkbox')
    expect(box.querySelector('svg')).toBeNull()
    expect(box.getAttribute('aria-checked')).toBe('false')
  })

  it('hides card actions while selecting', () => {
    const records = ['a', 'b'].map(record)
    useSelectionStore.getState().setOrder(records.map((item) => item.id))
    render(<HistoryGrid records={records} onOpen={() => {}} />)

    act(() => fireEvent.click(screen.getAllByRole('checkbox')[0]!))

    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.queryByLabelText('Favorite')).toBeNull()
  })

  it('shows a player only on a selected list row while selecting', () => {
    const records = ['a', 'b'].map(record)
    useSelectionStore.getState().setOrder(records.map((item) => item.id))
    setSelection(['b'])

    render(
      <div>
        <HistoryRow record={records[0]!} />
        <HistoryRow record={records[1]!} />
      </div>,
    )

    expect(screen.getAllByRole('button', { name: 'Play video' })).toHaveLength(1)
  })

  it('keeps a selected list row selected when its media is clicked', () => {
    const item = record('a')
    useSelectionStore.getState().setOrder(['a'])
    setSelection(['a'])
    const { container } = render(<HistoryRow record={item} />)

    const poster = container.querySelector('img')
    expect(poster).not.toBeNull()
    fireEvent.click(poster!)

    expect(ids()).toEqual(['a'])
  })

  it('starts a range from the anchor when nothing is selected', () => {
    const records = ['a', 'b', 'c', 'd'].map(record)
    useSelectionStore.getState().setOrder(records.map((item) => item.id))
    act(() => {
      useSelectionStore.getState().toggle('b')
      useSelectionStore.getState().toggle('b')
    })

    render(<HistoryGrid records={records} onOpen={() => {}} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Open video details' })[3]!, {
      shiftKey: true,
    })

    expect(ids()).toEqual(['b', 'c', 'd'])
  })

  it('keeps the bar width fixed for 1 and 200 selected', () => {
    const records = Array.from({ length: 200 }, (_, index) => record(`id-${index}`))
    useSelectionStore.getState().setOrder(records.map((item) => item.id))
    setSelection([records[0]!.id])
    render(<SelectionBar records={records} />)

    const one = screen.getByText('1 selected')
    const countClass = one.className
    expect(countClass).toContain('w-[96px]')
    expect(screen.getByText('Download').className).toContain('px-3.5')

    setSelection(records.slice(0, 3).map((item) => item.id))
    expect(screen.getByText('3 selected').className).toBe(countClass)

    setSelection(records.map((item) => item.id))
    expect(screen.getByText('200 selected').className).toBe(countClass)
    expect(screen.queryByText('Download 200')).toBeNull()
  })

  it('shows the last 3 selected thumbs, newest first', () => {
    const records = ['a', 'b', 'c', 'd'].map(record)
    useSelectionStore.getState().setOrder(records.map((item) => item.id))
    setSelection(['a'])
    render(<SelectionBar records={records} />)

    const stack = () => screen.getByTestId('selection-stack').querySelectorAll('img')
    expect(stack()).toHaveLength(1)

    setSelection(['b'])
    expect(stack()).toHaveLength(2)
    expect([...stack()].map((img) => img.getAttribute('src'))).toEqual([
      expect.stringContaining('b.preview'),
      expect.stringContaining('a.preview'),
    ])

    setSelection(['c'])
    expect(stack()).toHaveLength(3)
    setSelection(['d'])
    expect(stack()).toHaveLength(3)
    expect([...stack()].map((img) => img.getAttribute('src'))).toEqual([
      expect.stringContaining('d.preview'),
      expect.stringContaining('c.preview'),
      expect.stringContaining('b.preview'),
    ])
  })

  it('does not clear on Escape while a dialog is open', () => {
    const records = ['a', 'b'].map(record)
    setSelection(['a', 'b'])
    render(<SelectionBar records={records} />)

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(ids()).toEqual(['a', 'b'])

    dialog.remove()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(ids()).toEqual([])
  })

  it('splits 250 ids into 2 batch requests', async () => {
    const records = Array.from({ length: 250 }, (_, index) => record(`id-${index}`))
    useSelectionStore.getState().setOrder(records.map((item) => item.id))
    setSelection(records.map((item) => item.id))
    apiPost.mockResolvedValue({ done: [], skipped: [] })
    render(<SelectionBar records={records} />)

    fireEvent.click(screen.getByRole('button', { name: 'Like selected videos' }))

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2))
    const sizes = apiPost.mock.calls
      .map((call) => (call[1] as { ids: string[] }).ids.length)
      .sort((a, b) => a - b)
    expect(sizes).toEqual([50, 200])
  })
})
