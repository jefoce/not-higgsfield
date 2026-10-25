'use client'

import { type ChangeEvent, useState } from 'react'
import { isEmpty } from 'lodash-es'
import { ChevronRight } from 'lucide-react'

import { getPreset, MODEL_PRESETS } from '@/core/presets'
import { useModelEntry } from '@/lib/api/models'
import { useBoolean } from '@/lib/use-boolean'
import { useMediaQuery } from '@/lib/use-media-query'
import { SearchInput } from '@/ui/form/SearchInput'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { discountLabel } from '@/ui/Price'

import { useGeneratorStore } from '../store/store'
import { ModelRow } from './ModelRow'

/** Panel-width preset picker with search and capability badges. */
export function ModelPicker() {
  const modelMenu = useBoolean()
  const [query, setQuery] = useState('')

  const presetId = useGeneratorStore((state) => {
    return state.presetId
  })

  const setPreset = useGeneratorStore((state) => {
    return state.setPreset
  })

  const isWide = useMediaQuery('(min-width: 900px)')
  const preset = getPreset(presetId)
  const entry = useModelEntry(presetId)
  const discount = entry?.pricing?.discount ?? 0

  const options = MODEL_PRESETS.filter((option) => {
    return option.title.toLowerCase().includes(query.trim().toLowerCase())
  })

  const handleOpenChange = (isOpen: boolean): void => {
    modelMenu.set(isOpen)

    if (!isOpen) {
      setQuery('')
    }
  }

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value)
  }

  const handleSelectPreset = (id: string): void => {
    setPreset(id)
    modelMenu.off()
  }

  const side = isWide ? 'right' : 'bottom'

  return (
    <div className="mt-4">
      <Popover open={modelMenu.value} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-left hover:bg-white/6"
          >
            <span className="flex flex-col">
              <span className="flex items-center gap-2 text-xs text-fg-2">
                Model
                {discount > 0 && (
                  <span className="text-xxs text-lime">{discountLabel(discount)}</span>
                )}
              </span>
              <span className="text-sm font-medium">{preset.title}</span>
            </span>
            <ChevronRight size={16} className="text-fg-2" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={side}
          align="start"
          sideOffset={12}
          collisionPadding={16}
          className="flex max-h-[min(70vh,var(--radix-popover-content-available-height))] w-80 flex-col gap-1"
        >
          <SearchInput
            autoFocus
            value={query}
            onChange={handleQueryChange}
            placeholder="Search..."
            aria-label="Search models"
            className="border-0 bg-page-2 pr-2"
          />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {options.map((option) => {
              return (
                <ModelRow
                  key={option.id}
                  option={option}
                  selected={option.id === presetId}
                  onSelect={handleSelectPreset}
                />
              )
            })}
            {isEmpty(options) && <p className="p-3 text-center text-xs text-fg-2">No models</p>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
