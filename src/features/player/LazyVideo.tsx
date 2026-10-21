'use client'

import { Play, Video } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type RefObject } from 'react'
import { cn } from '@/lib/cn'
import { isOwnEvent } from '@/lib/events'
import { PlayerControls } from './PlayerControls'
import { usePlayerSlot } from './use-player-slot'
import { useVideoState } from './use-video-state'

const CENTER_PLAY =
  'absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70'

export interface LazyVideoProps {
  id: string
  src: string
  poster?: string
  aspect?: string
  className?: string
  alt?: string
  posterFit?: 'cover' | 'contain'
  videoFit?: 'cover' | 'contain'
  hoverPlay?: boolean
  /** False hides controls and releases the slot: selection mode owns the click. */
  interactive?: boolean
}

/**
 * Poster-only until the user plays it and the slot is active.
 * Only two videos stay loaded across the app. Hover mode keeps the slot on leave.
 */
export function LazyVideo(props: LazyVideoProps) {
  const {
    id,
    src,
    poster,
    aspect,
    className,
    alt,
    posterFit = 'contain',
    videoFit = 'contain',
    hoverPlay = false,
    interactive = true,
  } = props
  const { acquire, release, isActive } = usePlayerSlot()
  const active = isActive(id)
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pointerInside = useRef(false)
  const focusInside = useRef(false)
  const video = useVideoState({ videoRef, rootRef, active, src })

  const replay = () => {
    const element = videoRef.current
    if (!element || !element.paused) return
    void element.play().catch(() => undefined)
  }

  useEffect(() => {
    const node = rootRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) release(id)
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [id, release])

  useEffect(() => () => release(id), [id, release])

  // Selection mode turns the player off for unselected list rows.
  useEffect(() => {
    if (interactive || !active) return
    videoRef.current?.pause()
    release(id)
  }, [active, id, interactive, release])

  // Hover playback survives pointer leave, so a re-hover resumes the same slot.
  useEffect(() => {
    const element = videoRef.current
    if (!hoverPlay || !active || !element) return
    if (pointerInside.current || focusInside.current) void element.play().catch(() => undefined)
    else element.pause()
  }, [hoverPlay, active, src])

  const setInside = (ref: RefObject<boolean>, inside: boolean) => {
    if (!hoverPlay) return
    ref.current = inside
    if (inside) {
      acquire(id)
      replay()
      return
    }
    if (!pointerInside.current && !focusInside.current) videoRef.current?.pause()
  }

  const onPointerEnter = () => setInside(pointerInside, true)
  const onPointerLeave = () => setInside(pointerInside, false)
  const onFocus = () => setInside(focusInside, true)
  const onBlur = () => setInside(focusInside, false)

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isOwnEvent(event)) return
    if (event.target !== event.currentTarget) return
    if (event.code === 'Space') {
      event.preventDefault()
      video.togglePlay()
      return
    }
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      video.toggleFullscreen()
      return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    video.seekBy(event.key === 'ArrowLeft' ? -5 : 5)
  }

  const onRootClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isOwnEvent(event)) return
    if (event.shiftKey) return
    if (!active || (event.target as HTMLElement).closest('button, a, input')) return
    event.stopPropagation()
    video.togglePlay()
  }

  const fit = video.fullscreen || videoFit !== 'cover' ? 'object-contain' : 'object-cover'
  const controlsEnabled = interactive && !hoverPlay
  const rootHandlers = controlsEnabled ? { onClick: onRootClick, onKeyDown: onRootKeyDown } : {}
  const rootStyle = aspect ? { aspectRatio: aspect } : undefined
  const tabIndex = interactive ? 0 : -1

  return (
    <div
      ref={rootRef}
      tabIndex={tabIndex}
      {...rootHandlers}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      style={rootStyle}
      className={cn('group/player relative overflow-hidden bg-black outline-none', !aspect && 'h-full', className)}
    >
      {Boolean(active) && (
        <>
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            autoPlay
            playsInline
            muted={hoverPlay}
            loop={hoverPlay}
            preload="metadata"
            className={cn('h-full w-full bg-black', fit)}
          />
          {Boolean(controlsEnabled && video.paused) && (
            <button type="button" aria-label="Play" onClick={video.togglePlay} className={CENTER_PLAY}>
              <Play size={18} className="fill-current" aria-hidden />
            </button>
          )}
          {Boolean(controlsEnabled) && <PlayerControls video={video} />}
        </>
      )}
      {!active && (
        <>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- posters are pre-sized thumbs
            <img
              src={poster}
              loading="lazy"
              decoding="async"
              alt={alt ?? ''}
              className={cn('h-full w-full bg-black', posterFit === 'cover' ? 'object-cover' : 'object-contain')}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-subtle">
              <Video className="h-8 w-8 text-fg-2" aria-hidden />
            </div>
          )}
          {Boolean(controlsEnabled) && (
            <button
              type="button"
              aria-label="Play video"
              className={CENTER_PLAY}
              onClick={(event) => {
                event.stopPropagation()
                acquire(id)
              }}
            >
              <Play size={18} className="fill-current" aria-hidden />
            </button>
          )}
        </>
      )}
    </div>
  )
}
