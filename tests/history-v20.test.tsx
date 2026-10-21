// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DetailsPanel } from '@/features/history/DetailsPanel'
import { HistoryGrid } from '@/features/history/HistoryGrid'
import { HistoryRow } from '@/features/history/HistoryRow'
import { SelectionBar } from '@/features/history/SelectionBar'
import { useSelectionStore } from '@/features/history/selection-store'
import type { GenerationRecord, JobStatus } from '@/core/types'

const apiPost = vi.hoisted(() => vi.fn())
const apiDelete = vi.hoisted(() => vi.fn())
const confirm = vi.hoisted(() => vi.fn())

vi.mock('@/lib/fetcher', () => ({
  apiPost,
  apiDelete,
  apiPatch: vi.fn(),
  fetcher: vi.fn(),
  ApiError: class ApiError extends Error {
    status = 0
  },
}))

vi.mock('@/lib/platform', () => ({
  platform: { confirm, saveVideo: vi.fn(), saveVideos: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

class Observer {
  observe() {}
  disconnect() {}
}

const RAW_ERROR = 'Provider said no.'
const MIXED_TITLE = 'Only finished videos can be downloaded or liked.'

interface RecordOverrides {
  status?: JobStatus
  error?: string
  favorite?: boolean
}

function record(id: string, overrides: RecordOverrides = {}): GenerationRecord {
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
    ...overrides,
  }
}

const ids = () => [...useSelectionStore.getState().ids]
const setSelection = (list: string[]) => act(() => useSelectionStore.getState().setMany(list, true))
const setOrder = (list: string[]) => useSelectionStore.getState().setOrder(list)

function tile(container: HTMLElement, id: string): HTMLElement {
  return container.querySelector<HTMLElement>(`#history-item-${id} [role="button"]`)!
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  useSelectionStore.getState().clear()
  apiPost.mockReset()
  apiDelete.mockReset()
  confirm.mockReset()
  confirm.mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  vi.unstubAllGlobals()
})

describe('C1 selectable cards', () => {
  it('renders a checkbox for terminal records only', () => {
    const records = [
      record('done'),
      record('bad', { status: 'failed', error: RAW_ERROR }),
      record('cancelled', { status: 'cancelled' }),
      record('expired', { status: 'expired' }),
      record('active', { status: 'in_progress' }),
    ]
    setOrder(['done', 'bad', 'cancelled', 'expired'])
    const { container } = render(<HistoryGrid records={records} onOpen={() => {}} />)

    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(container.querySelector('#history-item-active [role="checkbox"]')).toBeNull()
  })

  it('ignores a click on an active card while selecting', () => {
    const records = [record('a'), record('b', { status: 'in_progress' })]
    setOrder(['a'])
    const { container } = render(<HistoryGrid records={records} onOpen={() => {}} />)

    act(() => fireEvent.click(screen.getByRole('checkbox')))
    expect(ids()).toEqual(['a'])

    fireEvent.click(tile(container, 'b'))
    expect(ids()).toEqual(['a'])
  })

  it('skips active cards in a shift range', () => {
    const records = [record('a'), record('b', { status: 'in_progress' }), record('c')]
    setOrder(['a', 'c'])
    const { container } = render(<HistoryGrid records={records} onOpen={() => {}} />)

    act(() => fireEvent.click(container.querySelector<HTMLElement>('#history-item-a [role="checkbox"]')!))
    fireEvent.click(container.querySelector<HTMLElement>('#history-item-c [role="checkbox"]')!, {
      shiftKey: true,
    })

    expect(ids()).toEqual(['a', 'c'])
  })
})

describe('C2 failed pill corner', () => {
  it('puts the single checkbox in the corner pill wrapper', () => {
    setOrder(['f'])
    render(<HistoryGrid records={[record('f', { status: 'failed', error: RAW_ERROR })]} onOpen={() => {}} />)

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(1)

    const wrapper = boxes[0]!.parentElement!.parentElement!
    expect(wrapper.className).toContain('z-30')
    expect(wrapper.className).toContain('left-4')
    expect(wrapper.className).toContain('top-4')
    expect(within(wrapper).getByText('Failed')).not.toBeNull()
  })

  it('keeps the pill and hides the checkbox on an active card', () => {
    render(<HistoryGrid records={[record('g', { status: 'in_progress' })]} onOpen={() => {}} />)

    expect(screen.getByText('Generating')).not.toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('C3 failed details panel', () => {
  it('shows Reuse and Details without the red error box', () => {
    render(<DetailsPanel record={record('f', { status: 'failed', error: RAW_ERROR })} />)

    expect(screen.getByRole('button', { name: 'Reuse' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Details' })).not.toBeNull()
    expect(screen.queryByText(RAW_ERROR)).toBeNull()
    expect(screen.queryByText('Generation failed')).toBeNull()
  })

  it('opens the raw monospace text plus Copy from Details', async () => {
    render(<DetailsPanel record={record('f', { status: 'failed', error: RAW_ERROR })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))

    const raw = await screen.findByText(RAW_ERROR)
    expect(raw.tagName).toBe('PRE')
    expect(raw.className).toContain('font-mono')
    expect(raw.className).toContain('text-xs')
    expect(screen.getByRole('button', { name: 'Copy' })).not.toBeNull()
  })
})

describe('C4 mixed selection bar', () => {
  it('disables download and like, keeps delete working for both', async () => {
    const records = [record('a'), record('b', { status: 'failed', error: RAW_ERROR })]
    setOrder(['a', 'b'])
    setSelection(['a', 'b'])
    apiPost.mockResolvedValue({ done: ['a', 'b'], skipped: [] })
    render(<SelectionBar records={records} />)

    const download = screen.getByRole('button', { name: 'Download' })
    const like = screen.getByRole('button', { name: 'Like selected videos' })
    const remove = screen.getByRole('button', { name: 'Delete selected videos' })

    expect((download as HTMLButtonElement).disabled).toBe(true)
    expect((like as HTMLButtonElement).disabled).toBe(true)
    expect(download.getAttribute('title')).toBe(MIXED_TITLE)
    expect(like.getAttribute('title')).toBe(MIXED_TITLE)
    expect((remove as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(remove)

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/api/generations/batch', {
        action: 'delete',
        ids: ['a', 'b'],
      }),
    )
  })
})

describe('C5 portal clicks', () => {
  it('does not open a tile from a More menu item', async () => {
    const onOpen = vi.fn()
    render(<HistoryGrid records={[record('a')]} onOpen={onOpen} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy prompt' }))

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('does not toggle row selection from the delete dialog', async () => {
    setOrder(['a', 'b'])
    setSelection(['a'])
    apiDelete.mockResolvedValue(undefined)
    render(<HistoryRow record={record('b')} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/api/generations/b'))
    expect(ids()).toEqual(['a'])
  })

  it('keeps heart, download and more interactive after the pointer leaves', async () => {
    const { container } = render(<HistoryGrid records={[record('a')]} onOpen={() => {}} />)
    const card = tile(container, 'a')
    const menu = within(card).getByRole('button', { name: 'More actions' })

    fireEvent.pointerDown(menu, { button: 0, ctrlKey: false })
    await screen.findByRole('menuitem', { name: 'Copy prompt' })
    fireEvent.pointerLeave(card)

    const open = 'group-has-[[data-card-menu][data-state=open]]/card:pointer-events-auto'
    for (const name of ['Favorite', 'Download', 'More actions']) {
      expect(within(card).getByRole('button', { name, hidden: true }).className).toContain(open)
    }
  })
})

describe('C6 liked list row', () => {
  it('pins the heart without the count pill or a lower stack', () => {
    const { container } = render(<HistoryRow record={record('a', { favorite: true })} />)
    const media = container.firstElementChild!.firstElementChild as HTMLElement

    const hearts = within(media).getAllByRole('button', { name: 'Remove favorite' })
    expect(hearts).toHaveLength(1)
    expect(within(media).queryByText('1')).toBeNull()

    const heart = hearts[0]!
    expect(heart.className).not.toContain('opacity-0')

    const stack = heart.parentElement!
    expect(stack.className).toContain('top-3')
    expect(stack.className).not.toContain('top-[52px]')
  })
})
