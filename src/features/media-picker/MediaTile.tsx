'use client'

import { useState } from 'react'
import { Film, Image as ImageIcon, Link2, Maximize2, Pause, Play, Trash2 } from 'lucide-react'
import type { UploadItem } from '@/core/types'
import {
  currentDuration,
  currentSrc,
  pauseAudio,
  playAudio,
  useAudioPlaying,
  useAudioTime,
} from '@/lib/audio-player'
import { cn } from '@/lib/cn'
import { formatSecondsShort } from '@/lib/format'
import { waveBars } from '@/lib/wave-bars'
import { mediaUrl, thumbUrl } from './api'

export interface MediaTileProps {
  item: UploadItem
  mediaRef: string
  selected?: boolean
  selectIndex?: number
  disabled?: boolean
  missing?: boolean
  thumbVersion?: string | number
  onDelete?: () => void
  onSelect: () => void
  onPreview?: () => void
}

const AUDIO_BARS = 36

/** Square media tile with selection, source and missing states. */
export function MediaTile(props: MediaTileProps) {
  const {
    item,
    mediaRef,
    selected,
    selectIndex,
    disabled,
    missing,
    thumbVersion,
    onDelete,
    onSelect,
    onPreview,
  } = props
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  const blocked = Boolean(missing || disabled)
  const isAudio = item.kind === 'audio'
  const bars = isAudio ? waveBars(item.originalName, AUDIO_BARS) : []
  const badgeOffset = item.source === 'link' || missing ? 'pt-6' : ''
  const thumbSrc = thumbUrl({ ref: mediaRef, w: undefined, version: thumbVersion })
  const broken = brokenSrc === thumbSrc
  const previewable = item.kind === 'image' || item.kind === 'video'
  const audioSrc = isAudio ? mediaUrl(mediaRef, item.mime) : ''
  const audioPlaying = useAudioPlaying(audioSrc)
  const elapsed = useAudioTime(audioSrc)
  const total = item.durationSec ?? (currentSrc() === audioSrc ? currentDuration() : 0)
  const played = elapsed != null && total ? Math.min(1, elapsed / total) : 0

  return (
    <div
      className={cn(
        'group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface',
        missing && 'bg-danger/10',
        disabled && 'opacity-40',
        selected && 'ring-2 ring-lime ring-offset-2 ring-offset-surface',
      )}
    >
      {previewable && broken && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/5 text-fg-2">
          {item.kind === 'video' ? <Film size={24} aria-hidden /> : <ImageIcon size={24} aria-hidden />}
        </span>
      )}

      {previewable && !broken && (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized thumbs
        <img
          src={thumbSrc}
          loading="lazy"
          alt=""
          onError={() => setBrokenSrc(thumbSrc)}
          className="pointer-events-none absolute inset-0 h-full w-full bg-black/40 object-cover"
        />
      )}

      {item.kind === 'video' && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="h-7 w-7 fill-current" aria-hidden />
        </span>
      )}

      {item.kind === 'video' && item.durationSec != null && item.durationSec > 0 && (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1 text-xxs">
          {formatSecondsShort(item.durationSec)}
        </span>
      )}

      {isAudio && (
        <>
          <span
            className={cn(
              'pointer-events-none absolute left-2 right-8 top-2 z-20 truncate text-xs font-semibold',
              badgeOffset,
            )}
          >
            {item.originalName}
          </span>
          <span className="pointer-events-none absolute inset-x-2 top-1/2 flex h-10 max-h-10 -translate-y-1/2 items-center gap-px">
            {bars.map((height, index) => (
              <span
                key={index}
                style={{ height: `${height}%` }}
                className={cn(
                  'min-w-px flex-1 rounded-full',
                  index / bars.length < played ? 'bg-lime' : 'bg-fg-2/50',
                )}
              />
            ))}
          </span>
        </>
      )}

      <button
        type="button"
        onClick={onSelect}
        disabled={blocked}
        aria-label={item.originalName}
        aria-pressed={selected}
        className={cn(
          'absolute inset-0 z-10 h-full w-full rounded-lg',
          blocked ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      />

      {onPreview != null && !missing && !isAudio && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onPreview()
          }}
          aria-label={`Preview ${item.originalName}`}
          className="absolute left-1/2 top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-fg opacity-0 backdrop-blur transition hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Maximize2 size={16} aria-hidden />
        </button>
      )}

      {isAudio && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (audioPlaying) pauseAudio()
            else playAudio(audioSrc)
          }}
          aria-label={`${audioPlaying ? 'Pause' : 'Play'} ${item.originalName}`}
          disabled={Boolean(missing)}
          className="absolute bottom-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/50 text-fg backdrop-blur transition hover:bg-black/70 disabled:opacity-40"
        >
          {audioPlaying ? (
            <Pause size={14} className="fill-current" aria-hidden />
          ) : (
            <Play size={14} className="fill-current" aria-hidden />
          )}
        </button>
      )}

      {onDelete != null && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          onMouseDown={(event) => event.stopPropagation()}
          aria-label="Delete upload"
          className="absolute right-1 top-1 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-fg opacity-0 backdrop-blur transition hover:bg-danger/80 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      )}

      {Boolean(missing) && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 z-20 rounded bg-danger/20 px-1.5 py-0.5 text-xxs font-medium text-danger">
          Missing
        </span>
      )}

      {!missing && item.source === 'link' && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded bg-black/60 text-fg">
          <Link2 className="h-3 w-3" aria-hidden />
        </span>
      )}

      {Boolean(selected) && (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-lime text-xxs font-semibold text-on-lime">
          {(selectIndex ?? 0) + 1}
        </span>
      )}
    </div>
  )
}
