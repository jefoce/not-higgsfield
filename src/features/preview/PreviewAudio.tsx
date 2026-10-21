'use client'

import { useEffect } from 'react'
import { Pause, Play } from 'lucide-react'
import type { UploadItem } from '@/core/types'
import { waveBars } from '@/lib/wave-bars'
import {
  currentDuration,
  currentSrc,
  pauseAudio,
  playAudio,
  seekAudio,
  useAudioPlaying,
  useAudioTime,
} from '@/lib/audio-player'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'

const AUDIO_BARS = 80

interface PreviewAudioProps {
  item: UploadItem
  src: string
}

/** Uses the shared audio element so preview never adds a second player. */
export function PreviewAudio(props: PreviewAudioProps) {
  const { item, src } = props
  const playing = useAudioPlaying(src)
  const elapsed = useAudioTime(src)
  const total = item.durationSec ?? (currentSrc() === src ? currentDuration() : 0)
  const played = elapsed != null && total ? Math.min(1, elapsed / total) : 0
  const bars = waveBars(item.originalName, AUDIO_BARS)
  const at = elapsed ?? 0

  function toggle(): void {
    if (playing) pauseAudio()
    else playAudio(src)
  }

  function seekBy(delta: number): void {
    seekAudio(at + delta)
  }

  useEffect(() => {
    playAudio(src)
    return () => {
      if (currentSrc() === src) pauseAudio()
    }
  }, [src])

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl bg-surface p-4">
      <span className="truncate text-sm font-semibold">{item.originalName}</span>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Seek audio"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.round(at * 10) / 10}
        aria-valuetext={`${formatClock(at)} / ${formatClock(total)}`}
        onClick={(event) => {
          if (!total) return
          const rect = event.currentTarget.getBoundingClientRect()
          seekAudio(((event.clientX - rect.left) / rect.width) * total)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            seekBy(event.key === 'ArrowLeft' ? -5 : 5)
          } else if (event.key === ' ') {
            event.preventDefault()
            toggle()
          }
        }}
        className="flex h-20 w-full cursor-pointer items-center gap-px rounded"
      >
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
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggle}
          aria-label={`${playing ? 'Pause' : 'Play'} ${item.originalName}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-fg backdrop-blur transition hover:bg-black/60"
        >
          {playing ? (
            <Pause size={16} className="fill-current" aria-hidden />
          ) : (
            <Play size={16} className="fill-current" aria-hidden />
          )}
        </button>
        <span className="text-xs tabular-nums text-fg-2">
          {formatClock(elapsed ?? 0)} / {formatClock(total)}
        </span>
      </div>
    </div>
  )
}
