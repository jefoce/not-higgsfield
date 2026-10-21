'use client'

import { Clock } from 'lucide-react'
import { clamp } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'
import { getPreset, minDuration } from '@/core/presets'
import { maxDurationFor } from '@/core/validation'
import { formatSecondsShort } from '@/lib/format'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { Slider } from '@/ui/Slider'
import { Tooltip } from '@/ui/Tooltip'
import { inputFromState, useGeneratorStore } from './store'

interface ChipClassParams {
  value: number
  duration: number
  limit: number
}

function chipClass(params: ChipClassParams): string {
  const { value, duration, limit } = params
  const base = 'h-8 rounded-md px-2 text-xs font-medium'
  if (value > limit) return `${base} bg-white/5 text-fg-2 opacity-40`
  if (value === duration) return `${base} bg-lime/15 text-lime`
  return `${base} bg-white/5 text-fg-2 hover:text-fg`
}

/** Duration setting button and slider popover capped by reference video length. */
export function DurationPopover() {
  const draft = useGeneratorStore(
    useShallow((state) => ({
      presetId: state.presetId,
      tab: state.tab,
      prompts: state.prompts,
      audio: state.audio,
      duration: state.duration,
      aspectRatio: state.aspectRatio,
      resolution: state.resolution,
      frames: state.frames,
      references: state.references,
      seed: state.seed,
    })),
  )
  const uploadsById = useGeneratorStore((state) => state.uploadsById)
  const setDuration = useGeneratorStore((state) => state.setDuration)
  const preset = getPreset(draft.presetId)
  const { max } = preset.duration
  const min = minDuration(preset)
  const limit = maxDurationFor({
    input: inputFromState(draft),
    uploads: uploadsById,
    preset,
  })
  const chips = (preset.duration.options ?? []).filter((value) => value >= min && value <= max)
  const floored = min > preset.duration.min
  const totalVideo = draft.references.reduce((sum, id) => {
    const upload = uploadsById[id]
    return upload?.kind === 'video' ? sum + (upload.durationSec ?? 0) : sum
  }, 0)
  const capped = limit < max
  const limitText = `Up to ${limit}s with ${formatSecondsShort(totalVideo)} of reference video`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 flex-1 items-center gap-1 rounded-md bg-surface px-2 text-sm font-medium text-fg hover:bg-white/[0.06]"
        >
          <Clock size={16} />
          {draft.duration}s
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="flex items-center justify-between text-xs text-fg-2">
          <span>Duration</span>
          <span className="text-fg">{draft.duration}s</span>
        </div>
        <Slider
          value={draft.duration}
          min={min}
          max={limit}
          step={1}
          ariaLabel="Duration"
          name="duration"
          onValueChange={(value) => setDuration(clamp(value, min, limit))}
        />
        {capped && <p className="text-xs text-fg-2">{limitText}</p>}
        {floored && <p className="text-xs text-fg-2">Minimum billed duration is {min}s</p>}
        <div className="flex flex-wrap gap-1.5">
          {chips.map((value) => (
            <Tooltip key={value} content={value > limit ? limitText : null}>
              <span className="inline-flex">
                <PopoverClose asChild>
                  <button
                    type="button"
                    disabled={value > limit}
                    onClick={() => setDuration(value)}
                    className={chipClass({ value, duration: draft.duration, limit })}
                  >
                    {value}s
                  </button>
                </PopoverClose>
              </span>
            </Tooltip>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
