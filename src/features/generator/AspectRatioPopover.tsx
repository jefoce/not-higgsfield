'use client'

import { Check, Ratio } from 'lucide-react'
import type { AspectChoice, AspectRatio } from '@/core/presets'
import { getPreset } from '@/core/presets'
import { aspectAllowed } from '@/core/output-size'
import { cn } from '@/lib/cn'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { Tooltip } from '@/ui/Tooltip'
import { useGeneratorStore } from './store'

interface RatioIconProps {
  ratio: AspectRatio
}

function RatioIcon(props: RatioIconProps) {
  const { ratio } = props
  const [width, height] = ratio.split(':').map(Number)
  const scale = 14 / Math.max(width, height)
  return (
    <span
      className="inline-block rounded-[2px] border border-current"
      style={{ width: width * scale, height: height * scale }}
    />
  )
}

/** Aspect ratio button and preset list with conditional Auto. */
export function AspectRatioPopover() {
  const aspectRatio = useGeneratorStore((state) => state.aspectRatio)
  const setAspectRatio = useGeneratorStore((state) => state.setAspectRatio)
  const tab = useGeneratorStore((state) => state.tab)
  const start = useGeneratorStore((state) => state.frames.start)
  const resolution = useGeneratorStore((state) => state.resolution)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))

  const autoAllowed = tab === 'frames' && Boolean(start) && preset.autoAspectWithFrames
  const options: AspectChoice[] = autoAllowed ? ['auto', ...preset.aspectRatios] : [...preset.aspectRatios]
  const ratioLabel = aspectRatio === 'auto' ? 'Auto' : aspectRatio

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && aspectRatio === 'auto' && !autoAllowed) setAspectRatio(preset.defaultAspectRatio)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 flex-1 items-center gap-1 rounded-md bg-surface px-3 text-sm font-medium text-fg hover:bg-white/[0.06]"
        >
          <Ratio size={16} />
          {ratioLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-40 space-y-1">
        {options.map((option) => {
          const allowed = option === 'auto' || aspectAllowed({ preset, resolution, aspect: option })
          const onlyAt = option === 'auto'
            ? []
            : preset.resolutions.filter((candidate) => preset.outputSizes?.[candidate]?.[option])
          const reason = allowed || !onlyAt.length ? null : `Only at ${onlyAt.join(', ')}`
          const optionLabel = option === 'auto' ? 'Auto' : option
          return (
            <Tooltip key={option} content={reason}>
              <span className="inline-flex w-full">
                <PopoverClose asChild>
                  <button
                    type="button"
                    disabled={!allowed}
                    onClick={() => setAspectRatio(option)}
                    className={cn(
                      'flex min-h-9 w-full items-center gap-2 rounded-lg p-2 text-sm font-medium',
                      !allowed && 'cursor-not-allowed opacity-40',
                      option === aspectRatio ? 'text-lime' : 'text-fg',
                      allowed && option !== aspectRatio && 'hover:bg-white/5',
                    )}
                  >
                    {option === 'auto' ? <Ratio size={14} /> : <RatioIcon ratio={option} />}
                    {optionLabel}
                    {option === aspectRatio && <Check size={14} className="ml-auto" />}
                  </button>
                </PopoverClose>
              </span>
            </Tooltip>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
