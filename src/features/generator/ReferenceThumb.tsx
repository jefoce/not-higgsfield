'use client'

import Image from 'next/image'
import { FileX, Link2Off, Maximize2, Pause, Play, X } from 'lucide-react'
import type { UploadItem } from '@/core/types'
import { mediaUrl, thumbUrl } from '@/features/media-picker/api'
import { waveBars } from '@/lib/wave-bars'
import {
  currentDuration,
  currentSrc,
  pauseAudio,
  playAudio,
  useAudioPlaying,
  useAudioTime,
} from '@/lib/audio-player'
import { formatMediaDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

const AUDIO_BARS = 40

interface AudioReferenceProps {
  upload: UploadItem
  src: string
  name: string
}

/** Two-column audio tile with waveform progress and a play button. */
function AudioReference(props: AudioReferenceProps) {
  const { upload, src, name } = props
  const playing = useAudioPlaying(src)
  const elapsed = useAudioTime(src)
  const total = upload.durationSec ?? (currentSrc() === src ? currentDuration() : 0)
  const played = elapsed != null && total ? elapsed / total : 0
  const bars = waveBars(upload.originalName, AUDIO_BARS)

  return (
    <div className="flex size-full flex-col justify-between overflow-hidden rounded-xl bg-white/10 px-1.5 py-1">
      <span className="flex h-4 w-full items-end gap-px">
        {bars.map((height, index) => (
          <span
            key={index}
            style={{ height: `${height}%` }}
            className={cn('flex-1 rounded-full', index / bars.length < played ? 'bg-lime' : 'bg-fg-2/60')}
          />
        ))}
      </span>
      <span className="flex h-4 items-center justify-between">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (playing) pauseAudio()
            else playAudio(src)
          }}
          aria-label={`${playing ? 'Pause' : 'Play'} ${name}`}
          className="flex h-4 w-4 items-center justify-center rounded-full bg-black/40 text-fg hover:bg-black/60"
        >
          {playing ? (
            <Pause size={10} className="fill-current" aria-hidden />
          ) : (
            <Play size={10} className="fill-current" aria-hidden />
          )}
        </button>
        <span className="text-[10px] leading-none tabular-nums text-white/50">
          {formatMediaDuration(elapsed ?? total, true)}
        </span>
      </span>
    </div>
  )
}

interface ReferenceThumbProps {
  upload?: UploadItem
  label?: string
  missing?: boolean
  lifted?: boolean
  note?: string
  onOpenPreview?: () => void
  onRemove: () => void
}

/** One reference tile with preview and remove. Sorting lives in the wrapper. */
export function ReferenceThumb(props: ReferenceThumbProps) {
  const {
    upload,
    label,
    missing,
    lifted,
    note,
    onOpenPreview,
    onRemove,
  } = props
  const isMissing = Boolean(missing || upload?.missing)
  const broken = !upload || isMissing
  const isAudio = upload?.kind === 'audio'
  const isVideo = upload?.kind === 'video'
  const openable = Boolean(upload && !broken && !isAudio && onOpenPreview)
  const name = upload?.originalName ?? label ?? 'reference'
  const audioSrc = isAudio && upload ? mediaUrl(`uploads/${upload.id}`, upload.mime) : ''
  let title = name
  if (broken) title = isMissing ? `File missing: ${name}` : 'File deleted'
  else if (label) title = `${label} \u00b7 ${name}`
  let overlayClass = 'hidden group-hover:flex'
  if (broken) overlayClass = 'flex'
  if (lifted) overlayClass = 'hidden'
  return (
    <Tooltip content={note ? `${title} \u00b7 ${note}` : title}>
      <div
        className={cn(
          'group relative cursor-grab rounded-xl active:cursor-grabbing',
          isAudio ? 'col-span-2 aspect-[2.12/1]' : 'aspect-square',
          lifted && 'cursor-grabbing shadow-2xl',
        )}
      >
        <div
          className={cn(
            'absolute inset-0 overflow-hidden',
            isAudio ? 'rounded-xl' : 'rounded-xl bg-surface-2 ring-1 ring-inset ring-white/10',
          )}
        >
          {upload != null && !isAudio && (
            <Image
              src={thumbUrl({ ref: `uploads/${upload.id}`, w: 320 })}
              alt={upload.originalName}
              fill
              unoptimized
              draggable={false}
              className="pointer-events-none object-cover bg-black/40"
            />
          )}

          {upload != null && Boolean(isAudio) && (
            <AudioReference upload={upload} src={audioSrc} name={name} />
          )}

          {upload != null && Boolean(isVideo) && upload.durationSec != null && (
            <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1 text-xxs font-medium tabular-nums text-fg">
              {formatMediaDuration(upload.durationSec)}
            </span>
          )}

          {broken && (
            <span
              aria-label={isMissing ? 'File missing' : 'File deleted'}
              className={cn(
                'pointer-events-none absolute inset-0 flex items-center justify-center',
                isMissing ? 'bg-danger/15 text-danger' : 'bg-page-2 text-fg-2',
              )}
            >
              {isMissing ? <Link2Off size={20} aria-hidden /> : <FileX size={20} aria-hidden />}
            </span>
          )}

          {openable && (
            <button
              type="button"
              onClick={onOpenPreview}
              aria-label={`Preview ${label ?? name}`}
              className="absolute inset-0 z-0 h-full w-full cursor-pointer"
            />
          )}

          {openable && !lifted && (
            <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-fg backdrop-blur">
                <Maximize2 size={12} aria-hidden />
              </span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (isAudio && currentSrc() === audioSrc) pauseAudio()
            onRemove()
          }}
          aria-label={`Remove ${label ?? name}`}
          className={cn(
            'absolute -right-2 -top-2 z-20 h-4 w-4 items-center justify-center rounded-md border border-line bg-white/5 text-fg backdrop-blur',
            overlayClass,
          )}
        >
          <X size={8} />
        </button>
      </div>
    </Tooltip>
  )
}
