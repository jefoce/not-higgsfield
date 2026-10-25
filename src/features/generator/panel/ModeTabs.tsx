'use client'

import { useEffect } from 'react'

import { getPreset } from '@/core/presets'
import type { GeneratorTab } from '@/core/schemas/generation-record'
import { SegmentedTabs } from '@/ui/SegmentedTabs'
import { Tooltip } from '@/ui/Tooltip'

import { useGeneratorStore } from '../store/store'

/** Frames / References segment, References off when the preset has no inputs. */
export function ModeTabs() {
  const tab = useGeneratorStore((state) => state.tab)
  const setTab = useGeneratorStore((state) => state.setTab)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const refs = preset.references
  const isRefsDisabled = refs.image + refs.video + refs.audio === 0

  const handleValueChange = (value: string): void => setTab(value as GeneratorTab)

  useEffect(() => {
    if (isRefsDisabled && tab === 'references') {
      setTab('frames')
    }
  }, [isRefsDisabled, tab, setTab])

  const tooltip = isRefsDisabled ? `Not supported by ${preset.title}` : null

  return (
    <Tooltip content={tooltip}>
      <span className="mb-4 block">
        <SegmentedTabs
          options={[
            { value: 'frames', label: 'Frames' },
            { value: 'references', label: 'References', disabled: isRefsDisabled },
          ]}
          value={tab}
          onValueChange={handleValueChange}
        />
      </span>
    </Tooltip>
  )
}
