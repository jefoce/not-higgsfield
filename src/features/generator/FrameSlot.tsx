'use client'

import Image from 'next/image'
import { AlertTriangle, Image as ImageIcon, Maximize2, X } from 'lucide-react'
import { getPreset } from '@/core/presets'
import { thumbUrl } from '@/features/media-picker/api'
import { useDropUpload } from '@/features/media-picker/use-drop-upload'
import { extensionsFromLimits, openMediaPicker } from '@/features/media-picker/store'
import { openPreview } from '@/features/preview/preview-store'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'
import { useGeneratorStore } from './store'

interface FrameSlotProps {
  slot: 'start' | 'end'
  disabled?: boolean
  disabledReason?: string
}

const TARGETS = { start: 'frame-start', end: 'frame-end' } as const
const LABELS = { start: 'Start frame', end: 'End frame' } as const

/** One frame drop slot with preview, replace and remove actions. */
export function FrameSlot(props: FrameSlotProps) {
  const { slot, disabled, disabledReason } = props
  const frameId = useGeneratorStore((state) => state.frames[slot])
  const upload = useGeneratorStore((state) => (frameId ? state.uploadsById[frameId] : undefined))
  const setFrame = useGeneratorStore((state) => state.setFrame)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const extensions = extensionsFromLimits(preset.referenceLimits)
  const { dragging, dropProps } = useDropUpload({
    id: `frame-${slot}`,
    enabled: !disabled,
    kinds: ['image'],
    extensions,
    onUploaded: ([item]) => {
      if (item) setFrame(slot, item)
    },
  })
  const hasFrame = Boolean(frameId)
  const broken = hasFrame && (!upload || upload.missing)
  const previewable = Boolean(hasFrame && upload && !upload.missing)

  const pick = () =>
    openMediaPicker({
      target: TARGETS[slot],
      kinds: ['image'],
      max: 1,
      extensions,
      onPick: ([item]) => {
        if (item) setFrame(slot, item)
      },
    })

  const preview = () => {
    if (!upload) return
    openPreview({
      items: [upload],
      index: 0,
      actions: {
        replace: () => pick(),
        remove: () => setFrame(slot, null),
      },
    })
  }

  const onActivate = previewable ? preview : pick
  const label = previewable ? `Preview ${LABELS[slot].toLowerCase()}` : LABELS[slot]

  const card = (
    <div
      className={cn(
        'group relative h-[136px] w-full rounded-2xl border border-dashed border-divider bg-surface p-2',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[4px]">
        <button
          type="button"
          disabled={disabled}
          onClick={onActivate}
          aria-label={label}
          className="absolute inset-0 z-0 h-full w-full cursor-pointer disabled:cursor-not-allowed"
        />

        {upload != null && (
          <Image
            src={thumbUrl({ ref: `uploads/${upload.id}`, w: 640 })}
            alt={LABELS[slot]}
            fill
            unoptimized
            className="pointer-events-none object-contain bg-black/40"
          />
        )}

        {!!broken && (
          <span className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-danger/15 text-xs font-medium text-danger">
            <AlertTriangle size={20} aria-hidden />
            File missing
          </span>
        )}

        {!!previewable && (
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-fg backdrop-blur">
              <Maximize2 size={12} aria-hidden />
            </span>
          </span>
        )}

        {!hasFrame && (
          <>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-fg-2 mix-blend-luminosity shadow-[0_128.852px_36.007px_rgba(0,0,0,0),0_82.429px_33.031px_rgba(0,0,0,0.01),0_46.422px_27.972px_rgba(0,0,0,0.05),0_20.533px_20.533px_rgba(0,0,0,0.09),0_5.059px_11.308px_rgba(0,0,0,0.1),inset_0_-0.298px_5.356px_rgba(185,185,185,0.35)] backdrop-blur-[4px]">
                <ImageIcon size={16} />
              </span>
              <span className="cursor-default text-sm font-medium text-fg-2">{LABELS[slot]}</span>
            </div>
            <span className="pointer-events-none absolute right-0 top-0 rounded-3xl bg-white/5 px-1.5 py-1 text-[8px] font-normal leading-[12.5px] text-fg-2 backdrop-blur-sm">
              Optional
            </span>
          </>
        )}
      </div>

      {!!hasFrame && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setFrame(slot, null)
          }}
          aria-label={`Remove ${LABELS[slot].toLowerCase()}`}
          className={cn(
            'absolute -right-1.5 -top-1.5 z-20 h-6 w-6 items-center justify-center rounded-full bg-black/70 text-fg backdrop-blur hover:bg-black',
            broken ? 'flex' : 'hidden group-hover:flex',
          )}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )

  let tooltip: string | null | undefined = null
  if (broken) tooltip = 'File missing'
  if (disabled) tooltip = disabledReason
  return (
    <Tooltip content={tooltip}>
      <span className={cn('block w-full', dragging && 'ring-1 ring-lime/40')} {...dropProps}>
        {card}
      </span>
    </Tooltip>
  )
}
