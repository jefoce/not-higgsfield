'use client'

import { Dices, Lock } from 'lucide-react'
import { SEED_MAX } from '@/core/constants'
import { getPreset } from '@/core/presets'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { NumberInput } from '@/ui/form/NumberInput'
import { Switch } from '@/ui/form/Switch'
import { Tooltip } from '@/ui/Tooltip'
import { randomSeed, useGeneratorStore } from './store'

/** Random / fixed seed chip with its popover. Hidden when the model has no seed. */
export function SeedChip() {
  const seed = useGeneratorStore((state) => state.seed)
  const setSeed = useGeneratorStore((state) => state.setSeed)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const random = seed === null

  if (!preset.seed) return null

  return (
    <Popover>
      <Tooltip content="Provider may not guarantee identical results">
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-page-2 px-[6px] py-1 text-xs font-medium leading-4 text-fg hover:bg-white/5"
          >
            {random ? <Dices size={14} /> : <Lock size={14} />}
            {random ? 'Random' : seed}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-fg-2">Random seed</span>
          <Switch
            checked={random}
            onCheckedChange={(checked) => setSeed(checked ? null : randomSeed())}
            aria-label="Random seed"
          />
        </div>
        <NumberInput
          id="seed-value"
          name="seed"
          aria-label="Seed value"
          min={0}
          max={SEED_MAX}
          disabled={random}
          value={seed}
          onValueChange={(next) => setSeed(next ?? 0)}
          className="h-8 px-2 text-xs"
        />
        <button
          type="button"
          onClick={() => setSeed(randomSeed())}
          className="h-8 w-full rounded-lg bg-subtle text-xs font-medium text-fg hover:bg-hover"
        >
          Randomize
        </button>
      </PopoverContent>
    </Popover>
  )
}
