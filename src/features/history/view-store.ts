'use client'

import { clamp } from 'lodash-es'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ZOOM_DEFAULT, ZOOM_STEPS } from '@/core/constants'
import type { HistoryFilters } from '@/core/types'

export type HistoryMode = 'all' | 'text' | 'frames' | 'references'
/** HistoryFilters plus the mode query the list route understands. */
export type ViewFilters = HistoryFilters & { mode?: HistoryMode }

export type HistoryView = 'list' | 'grid'

const DEFAULT_FILTERS: ViewFilters = {
  status: 'all',
  tab: 'all',
  resolution: 'all',
  aspect: 'all',
  audio: 'any',
  mode: 'all',
  model: 'all',
}

const MAX_ZOOM = ZOOM_STEPS - 1

/** Reference width the supplied slider sizes were measured at (video + details + gap). */
const REFERENCE_ROW_WIDTH = 1518

const LIST_VIDEO_WIDTHS = [604, 710, 830, 980, 1132, 1270] as const

const GRID_COLUMNS = [8, 7, 6, 5, 4, 3] as const

const TILE_WIDTHS = [172, 200, 252, 286, 362, 486] as const

const zoomStep = (zoom: number): number => clamp(Math.round(zoom), 0, MAX_ZOOM)

/** Video width as a share of the list row at each zoom step. */
export const listVideoShare = (zoom: number): number =>
  LIST_VIDEO_WIDTHS[zoomStep(zoom)] / REFERENCE_ROW_WIDTH

/** Fixed grid columns per step: 8 at zoom 0 down to 3 at max. */
export const zoomToGridColumns = (zoom: number): number => GRID_COLUMNS[zoomStep(zoom)]

/** Tile width from the design table, measured at the 1518px reference row. */
export const zoomToTileWidth = (zoom: number): number => TILE_WIDTHS[zoomStep(zoom)]

export function countActiveFilters(filters: ViewFilters): number {
  let count = 0
  if (filters.q?.trim()) count += 1
  if (filters.favorite) count += 1
  if (filters.status && filters.status !== 'all') count += 1
  if (filters.resolution && filters.resolution !== 'all') count += 1
  if (filters.aspect && filters.aspect !== 'all') count += 1
  if (filters.audio && filters.audio !== 'any') count += 1
  if (filters.mode && filters.mode !== 'all') count += 1
  if (filters.model && filters.model !== 'all') count += 1
  return count
}

interface ViewState {
  view: HistoryView
  zoom: number
  filters: ViewFilters
  setView: (view: HistoryView) => void
  setZoom: (zoom: number) => void
  setFilters: (patch: Partial<ViewFilters>) => void
  resetFilters: () => void
}

export const useHistoryViewStore = create<ViewState>()(
  persist(
    (set) => ({
      view: 'list',
      zoom: ZOOM_DEFAULT,
      filters: { ...DEFAULT_FILTERS },
      setView: (view) => set({ view }),
      setZoom: (zoom) => set({ zoom: clamp(Math.round(zoom), 0, MAX_ZOOM) }),
      setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
      resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
    }),
    {
      name: 'not-higgsfield:view',
      version: 1,
      partialize: (state) => ({ view: state.view, zoom: state.zoom, filters: state.filters }),
    },
  ),
)
