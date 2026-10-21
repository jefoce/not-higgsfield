'use client'

import { useEffect } from 'react'
import { getPreset } from '@/core/presets'
import type { GeneratorTab } from '@/core/types'
import { SegmentedTabs } from '@/ui/SegmentedTabs'
import { Tooltip } from '@/ui/Tooltip'
import { useGeneratorStore } from './store'

/** Frames / References segment, References off when the preset has no inputs. */
export function ModeTabs() {
  const tab = useGeneratorStore((state) => state.tab)
  const setTab = useGeneratorStore((state) => state.setTab)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const refs = preset.references
  const refsDisabled = refs.image + refs.video + refs.audio === 0

  useEffect(() => {
    if (refsDisabled && tab === 'references') setTab('frames')
  }, [refsDisabled, tab, setTab])

  const tooltip = refsDisabled ? `Not supported by ${preset.title}` : null

  return (
    <Tooltip content={tooltip}>
      <span className="mb-4 block">
        <SegmentedTabs
          options={[
            { value: 'frames', label: 'Frames' },
            { value: 'references', label: 'References', disabled: refsDisabled },
          ]}
          value={tab}
          onValueChange={(value) => setTab(value as GeneratorTab)}
        />
      </span>
    </Tooltip>
  )
}
