'use client'

import { clamp, isNil } from 'lodash-es'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ZOOM_DEFAULT, ZOOM_STEPS } from '@/core/constants'
import { DEFAULT_FILTERS, FILTER_PARAMS } from '@/core/history-filters'
import type { HistoryFilters, HistoryMode } from '@/core/types'

export type HistoryView = 'list' | 'grid'

interface ViewFilters extends HistoryFilters {
  mode?: HistoryMode
}

const MAX_ZOOM = ZOOM_STEPS - 1

/** Reference width the supplied slider sizes were measured at (video + details + gap). */
const REFERENCE_ROW_WIDTH = 1518

const LIST_VIDEO_WIDTHS = [604, 710, 830, 980, 1132, 1270] as const

const GRID_COLUMNS = [8, 7, 6, 5, 4, 3] as const

const TILE_WIDTHS = [172, 200, 252, 286, 362, 486] as const

const zoomStep = (zoom: number): number => {
  return clamp(Math.round(zoom), 0, MAX_ZOOM)
}

/** Table value at a clamped zoom step. The ranges below cover every step. */
function stepValue<T>(values: readonly T[], zoom: number): T {
  const value = values.at(zoomStep(zoom))

  if (isNil(value)) {
    throw new Error(`Unknown zoom step: ${zoom}`)
  }

  return value
}

/** Video width as a share of the list row at each zoom step. */
export const listVideoShare = (zoom: number): number => {
  return stepValue(LIST_VIDEO_WIDTHS, zoom) / REFERENCE_ROW_WIDTH
}

/** Fixed grid columns per step: 8 at zoom 0 down to 3 at max. */
export const zoomToGridColumns = (zoom: number): number => {
  return stepValue(GRID_COLUMNS, zoom)
}

/** Tile width from the design table, measured at the 1518px reference row. */
export const zoomToTileWidth = (zoom: number): number => {
  return stepValue(TILE_WIDTHS, zoom)
}

export function countActiveFilters(filters: ViewFilters): number {
  const active = FILTER_PARAMS.filter(([key, fallback]) => {
    const value = filters[key]

    return Boolean(value) && value !== fallback
  })

  const favorites = filters.favorite === true ? 1 : 0
  const isQuery = Boolean(filters.q?.trim())

  const query = isQuery ? 1 : 0

  return active.length + favorites + query
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
    (set) => {
      return {
        view: 'list',
        zoom: ZOOM_DEFAULT,
        filters: { ...DEFAULT_FILTERS },
        setView: (view) => {
          return set({ view })
        },
        setZoom: (zoom) => {
          return set({ zoom: clamp(Math.round(zoom), 0, MAX_ZOOM) })
        },
        setFilters: (patch) => {
          return set((state) => {
            return { filters: { ...state.filters, ...patch } }
          })
        },
        resetFilters: () => {
          return set({ filters: { ...DEFAULT_FILTERS } })
        },
      }
    },
    {
      name: 'not-higgsfield:view',
      version: 1,
      partialize: (state) => {
        return { view: state.view, zoom: state.zoom, filters: state.filters }
      },
    },
  ),
)
