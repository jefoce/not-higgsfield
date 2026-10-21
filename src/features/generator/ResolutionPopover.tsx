'use client'

import { Check, Diamond } from 'lucide-react'
import { formatRate, pricePerSec } from '@/core/pricing'
import { getPreset } from '@/core/presets'
import { cn } from '@/lib/cn'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { Tooltip } from '@/ui/Tooltip'
import { useGeneratorStore } from './store'
import { usePricing } from './use-pricing'

/** Resolution button and preset list with list and discounted per-second rates. */
export function ResolutionPopover() {
  const resolution = useGeneratorStore((state) => state.resolution)
  const setResolution = useGeneratorStore((state) => state.setResolution)
  const audio = useGeneratorStore((state) => state.audio)
  const aspect = useGeneratorStore((state) => state.aspectRatio)
  const hasVideoInput = useGeneratorStore(
    (state) =>
      state.tab === 'references' &&
      state.references.some((id) => state.uploadsById[id]?.kind === 'video'),
  )
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const { pricing } = usePricing()
  const discount = pricing?.discount ?? 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 flex-1 items-center gap-1 rounded-md bg-surface px-3 text-sm font-medium text-fg hover:bg-white/[0.06]"
        >
          <Diamond size={16} />
          {resolution}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 space-y-1">
        {preset.resolutions.map((option) => {
          const ctx = { resolution: option, aspect, audio, hasVideoInput }
          const rate = pricePerSec({ preset, ctx, skus: pricing?.skus })
          const listRate =
            discount > 0 ? pricePerSec({ preset, ctx, skus: pricing?.listSkus }) : null
          return (
            <PopoverClose asChild key={option}>
              <button
                type="button"
                onClick={() => setResolution(option)}
                className={cn(
                  'flex min-h-9 w-full items-center gap-2 rounded-lg p-2 text-sm font-medium',
                  option === resolution ? 'text-lime' : 'text-fg hover:bg-white/5',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{option}</span>
                    {rate === null ? (
                      <Tooltip content="Price varies for this model">
                        <span className="ml-auto text-xs text-fg-2 tabular-nums">--</span>
                      </Tooltip>
                    ) : (
                      <span className="ml-auto text-xs text-fg-2 tabular-nums">{formatRate(rate)}</span>
                    )}
                  </span>
                  <span className="flex justify-end text-xxs leading-4">
                    {listRate !== null && listRate !== rate && (
                      <span className="text-fg-3 line-through tabular-nums">{formatRate(listRate)}</span>
                    )}
                  </span>
                </span>
                <span className="flex w-3.5 h-3.5 shrink-0 items-center justify-center">
                  <Check
                    size={14}
                    className={cn('text-lime', option === resolution ? undefined : 'invisible')}
                  />
                </span>
              </button>
            </PopoverClose>
          )
        })}
        {pricing?.source === 'fallback' && (
          <p className="px-2 pb-1 text-xxs text-fg-2">Saved rates, live price unavailable</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
