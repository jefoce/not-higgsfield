'use client'

import { useEffect, useState, type RefObject } from 'react'

interface VideoState {
  paused: boolean
  muted: boolean
  time: number
  duration: number
  fullscreen: boolean
}

interface VideoActions {
  togglePlay: () => void
  toggleMute: () => void
  seek: (seconds: number) => void
  seekBy: (delta: number) => void
  toggleFullscreen: () => void
}

export type VideoApi = VideoState & VideoActions

/**
 * Media state and actions for one video element.
 * Listeners attach only while the slot is active.
 */
interface UseVideoStateParams {
  videoRef: RefObject<HTMLVideoElement | null>
  rootRef: RefObject<HTMLDivElement | null>
  active: boolean
  src: string
}

export function useVideoState(params: UseVideoStateParams): VideoApi {
  const { videoRef, rootRef, active, src } = params
  const [paused, setPaused] = useState(true)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!active || !video) return
    // Restores src after StrictMode's simulated unmount.
    if (video.getAttribute('src') !== src) video.src = src
    return () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [active, src, videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!active || !video) return
    setTime(0)
    setDuration(0)
    setPaused(video.paused)
    setMuted(video.muted)

    const syncTime = () => setTime(video.currentTime)
    const syncDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    const syncPaused = () => setPaused(video.paused)
    const syncMuted = () => setMuted(video.muted)

    video.addEventListener('timeupdate', syncTime)
    video.addEventListener('loadedmetadata', syncDuration)
    video.addEventListener('durationchange', syncDuration)
    video.addEventListener('play', syncPaused)
    video.addEventListener('pause', syncPaused)
    video.addEventListener('ended', syncPaused)
    video.addEventListener('volumechange', syncMuted)
    syncDuration()
    return () => {
      video.removeEventListener('timeupdate', syncTime)
      video.removeEventListener('loadedmetadata', syncDuration)
      video.removeEventListener('durationchange', syncDuration)
      video.removeEventListener('play', syncPaused)
      video.removeEventListener('pause', syncPaused)
      video.removeEventListener('ended', syncPaused)
      video.removeEventListener('volumechange', syncMuted)
    }
  }, [active, src, videoRef])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [rootRef])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => setPaused(true))
    else video.pause()
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (video) video.muted = !video.muted
  }

  const seek = (seconds: number) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(seconds)) return
    video.currentTime = seconds
    setTime(seconds)
  }

  const seekBy = (delta: number) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return
    video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + delta))
    setTime(video.currentTime)
  }

  const toggleFullscreen = async () => {
    const node = rootRef.current
    const video = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }
      if (node?.requestFullscreen) {
        await node.requestFullscreen()
        return
      }
      video?.webkitEnterFullscreen?.()
    } catch {
      // Fullscreen is not available in this webview.
    }
  }

  return { paused, muted, time, duration, fullscreen, togglePlay, toggleMute, seek, seekBy, toggleFullscreen }
}
