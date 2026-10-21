'use client'

import { useState } from 'react'
import {
  AudioLines,
  Check,
  ChevronRight,
  Clock,
  Diamond,
  Sparkles,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import { formatRate, pricePerSec } from '@/core/pricing'
import { MODEL_PRESETS, getPreset, type ModelPreset } from '@/core/presets'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/use-media-query'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { SearchInput } from '@/ui/form/SearchInput'
import { useGeneratorStore } from './store'
import { usePricing } from './use-pricing'

function quality(preset: ModelPreset): string {
  const first = preset.resolutions[0]
  const last = preset.resolutions.at(-1)
  return first === last ? first : `${first}-${last}`
}

function duration(preset: ModelPreset): string {
  const { min, max, options } = preset.duration
  return options?.length ? options.map((value) => `${value}s`).join(', ') : `${min}s-${max}s`
}

const PRESET_ICONS: Record<ModelPreset['icon'], LucideIcon> = {
  sparkles: Sparkles,
  'audio-lines': AudioLines,
}

interface BadgeProps {
  icon: LucideIcon
  text?: string
  label?: string
}

function Badge(props: BadgeProps) {
  const { icon: Icon, text, label } = props
  return (
    <span
      aria-label={label}
      className="inline-flex h-6 items-center gap-1 rounded-md bg-white/5 px-1.5 text-xs text-fg-2"
    >
      <Icon size={12} />
      {text}
    </span>
  )
}

/** Cheapest effective per-second rate across the model's resolutions. */
function fromRate(preset: ModelPreset, skus?: Record<string, number>): number | null {
  const ctx = {
    aspect: preset.defaultAspectRatio,
    audio: preset.audio.default,
    hasVideoInput: false,
  }
  const rates = preset.resolutions
    .map((resolution) => pricePerSec({ preset, ctx: { ...ctx, resolution }, skus }))
    .filter((rate): rate is number => rate !== null)
  return rates.length ? Math.min(...rates) : null
}

interface ModelRowProps {
  option: ModelPreset
  selected: boolean
  onSelect: () => void
}

function ModelRow(props: ModelRowProps) {
  const { option, selected, onSelect } = props
  const { pricing } = usePricing(option.id)
  const discount = pricing?.discount ?? 0
  const from = fromRate(option, pricing?.skus)
  const Icon = PRESET_ICONS[option.icon]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/[0.06]',
        selected && 'bg-white/[0.06]',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-fg-2">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.title}</span>
          {from !== null && (
            <span className="ml-2 shrink-0 text-xxs text-fg-3">
              from <span className={discount > 0 ? 'text-lime' : undefined}>{formatRate(from)}</span>
            </span>
          )}
          {discount > 0 && (
            <span className="shrink-0 text-xxs text-lime">{Math.round(discount * 100)}% off</span>
          )}
        </span>
        {Boolean(option.pickerNote) && (
          <span className="mt-0.5 block text-xxs text-fg-3">{option.pickerNote}</span>
        )}
        <span className="mt-1 flex flex-wrap gap-1">
          <Badge icon={Diamond} text={quality(option)} />
          <Badge icon={Clock} text={duration(option)} />
          {option.audio.supported && <Badge icon={Volume2} label="Audio" />}
        </span>
      </span>
      <span className="flex w-3.5 h-3.5 shrink-0 items-center justify-center">
        <Check size={14} className={cn('text-lime', selected ? undefined : 'invisible')} />
      </span>
    </button>
  )
}

/** Panel-width preset picker with search and capability badges. */
export function ModelPicker() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const presetId = useGeneratorStore((state) => state.presetId)
  const setPreset = useGeneratorStore((state) => state.setPreset)
  const wide = useMediaQuery('(min-width: 900px)')
  const preset = getPreset(presetId)
  const { pricing } = usePricing()
  const discount = pricing?.discount ?? 0
  const options = MODEL_PRESETS.filter((option) =>
    option.title.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div className="mt-4">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-left hover:bg-white/[0.06]"
          >
            <span className="flex flex-col">
              <span className="flex items-center gap-2 text-xs text-fg-2">
                Model
                {discount > 0 && (
                  <span className="text-xxs text-lime">{Math.round(discount * 100)}% off</span>
                )}
              </span>
              <span className="text-sm font-medium">{preset.title}</span>
            </span>
            <ChevronRight size={16} className="text-fg-2" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={wide ? 'right' : 'bottom'}
          align="start"
          sideOffset={12}
          collisionPadding={16}
          className="flex w-80 max-h-[min(70vh,var(--radix-popover-content-available-height))] flex-col gap-1"
        >
          <SearchInput
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            aria-label="Search models"
            className="border-0 bg-page-2 pr-2"
          />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {options.map((option) => (
              <ModelRow
                key={option.id}
                option={option}
                selected={option.id === presetId}
                onSelect={() => {
                  setPreset(option.id)
                  setOpen(false)
                }}
              />
            ))}
            {options.length === 0 && (
              <p className="p-3 text-center text-xs text-fg-2">No models</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
