'use client'

import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'
import type { VideoApi } from './use-video-state'

const CONTROL =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10'

const SEEK = [
  'h-4 w-full cursor-pointer appearance-none bg-transparent',
  '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-lime)_var(--progress),rgba(255,255,255,0.24)_var(--progress))]',
  '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:[margin-top:-3px]',
  '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,var(--color-lime)_var(--progress),rgba(255,255,255,0.24)_var(--progress))]',
  '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white',
].join(' ')

const HIDDEN =
  'pointer-events-none opacity-0 group-hover/player:pointer-events-auto group-hover/player:opacity-100 group-has-[:focus-visible]/player:pointer-events-auto group-has-[:focus-visible]/player:opacity-100'

interface PlayerControlsProps {
  video: VideoApi
}

/** Bottom bar with seek, play, mute, clock and fullscreen. Hides while playing until hover. */
export function PlayerControls(props: PlayerControlsProps) {
  const { video } = props
  const { paused, muted, time, duration, fullscreen } = video
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'absolute inset-x-0 bottom-0 flex h-[88px] flex-col justify-end gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 transition-opacity duration-150',
        !paused && HIDDEN,
      )}
    >
      <input
        type="range"
        aria-label="Seek"
        min={0}
        max={duration}
        step="any"
        value={Math.min(time, duration)}
        disabled={!duration}
        onChange={(event) => video.seek(Number(event.currentTarget.value))}
        style={{ '--progress': `${progress}%` } as CSSProperties}
        className={SEEK}
      />
      <div className="flex items-center gap-1.5 text-xs text-white/80">
        <button
          type="button"
          aria-label={paused ? 'Play' : 'Pause'}
          onClick={video.togglePlay}
          className={CONTROL}
        >
          {paused ? (
            <Play size={16} className="fill-current" aria-hidden />
          ) : (
            <Pause size={16} className="fill-current" aria-hidden />
          )}
        </button>
        <button
          type="button"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={video.toggleMute}
          className={CONTROL}
        >
          {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
        </button>
        <span className="ml-1 tabular-nums">
          {formatClock(time)} / {formatClock(duration)}
        </span>
        <button
          type="button"
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={video.toggleFullscreen}
          className={cn(CONTROL, 'ml-auto')}
        >
          {fullscreen ? <Minimize size={16} aria-hidden /> : <Maximize size={16} aria-hidden />}
        </button>
      </div>
    </div>
  )
}
