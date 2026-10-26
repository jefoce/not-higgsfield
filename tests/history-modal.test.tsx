// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
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
    render(<HistoryModal record={record('v')} open onOpenChange={handleNoop} />)

    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('max-w-450')
    expect(dialog.querySelector('.w-80')).not.toBeNull()

    const backdrop = dialog.querySelector('img.blur-3xl')

    expect(backdrop?.getAttribute('alt')).toBe('')
  })
})
