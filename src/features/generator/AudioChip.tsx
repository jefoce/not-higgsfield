'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { getPreset } from '@/core/presets'
import { useGeneratorStore } from './store'

/** Prompt audio toggle chip. Hidden when the model has no audio. */
export function AudioChip() {
  const audio = useGeneratorStore((state) => state.audio)
  const setAudio = useGeneratorStore((state) => state.setAudio)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))

  if (!preset.audio.supported) return null

  return (
    <button
      type="button"
      onClick={() => setAudio(!audio)}
      aria-pressed={audio}
      className="inline-flex items-center gap-1.5 rounded-lg bg-page-2 px-[6px] py-1 text-xs font-medium leading-4 text-fg hover:bg-white/5"
    >
      {audio ? <Volume2 size={14} /> : <VolumeX size={14} />}
      {audio ? 'On' : 'Off'}
    </button>
  )
}
