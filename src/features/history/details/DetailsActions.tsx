'use client'

import { isNil } from 'lodash-es'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

import type { MediaKindCounts } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import type { FriendlyError } from '@/core/provider-errors/types'
import type { GenerationRecord, GeneratorTab } from '@/core/schemas/generation-record'
import { focusGenerator } from '@/features/generator/focus-generator'
import { useGeneratorStore } from '@/features/generator/store/store'
import { slotCounts } from '@/features/generator/store/store-helpers'
import { closePreview } from '@/features/preview/preview-store'
import { formatDate } from '@/lib/format'
import { useAsyncAction } from '@/lib/use-async-action'
import { useBoolean } from '@/lib/use-boolean'
import { Button } from '@/ui/Button'
import { Tooltip } from '@/ui/Tooltip'

import { DeleteConfirm } from '../actions/DeleteConfirm'
import { MoreMenu } from '../actions/MoreMenu'
import { rerunRecord, saveRecordVideo, toggleFavorite } from '../actions/record-actions'
import { useAsInput as applyAsInput } from '../actions/record-menu-actions'
import { recordError } from '../actions/record-view'
import { ErrorDetailsPopover } from '../status/ErrorDetailsPopover'
import { totalTime } from './details-info'
import { DetailsActionButtons } from './DetailsActionButtons'

interface DetailsActionsProps {
  record: GenerationRecord
  isActive: boolean
  now: number
  onDeleted?: () => void
  onApplied?: () => void
}

interface ReferenceAvailabilityParams {
  preset: ModelPreset
  tab: GeneratorTab
  counts: MediaKindCounts
}

interface ReferenceAvailability {
  isDisabled: boolean
  tooltip: string
}

/** Reference button state and reason for the active generator mode. */
function referenceAvailability(params: ReferenceAvailabilityParams): ReferenceAvailability {
  const { preset, tab, counts } = params

  if (tab === 'frames') {
    if (!preset.frames.start) {
      return { isDisabled: true, tooltip: 'This model does not take a start frame' }
    }

    return { isDisabled: false, tooltip: 'Use last frame as start frame' }
  }

  if (preset.references.video === 0) {
    return { isDisabled: true, tooltip: 'This model does not take video references' }
  }

  if (counts.video >= preset.references.video) {
    return { isDisabled: true, tooltip: 'Reference limit reached' }
  }

  return { isDisabled: false, tooltip: 'Add as reference' }
}

/** Friendly error for failed records, null for every other status. */
function failedRecordError(record: GenerationRecord): FriendlyError | null {
  if (record.status !== 'failed') {
    return null
  }

  return recordError(record)
}

interface DetailsFooterParams {
  record: GenerationRecord
  onApplied?: () => void
}

/** Mode-aware actions and the error shown for one details record. */
function useDetailsFooter(params: DetailsFooterParams) {
  const { record, onApplied } = params

  const { presetId, tab } = useGeneratorStore(
    useShallow((state) => {
      return { presetId: state.presetId, tab: state.tab }
    }),
  )

  const counts = useGeneratorStore(useShallow(slotCounts))
  const availability = referenceAvailability({ preset: getPreset(presetId), tab, counts })
  const friendly = failedRecordError(record)

  const reuse = useAsyncAction(async () => {
    const isLoaded = await rerunRecord(record)

    if (!isLoaded) {
      return
    }

    onApplied?.()
  })

  const reference = useAsyncAction(async () => {
    const isApplied = await applyAsInput(record)

    if (!isApplied) {
      return
    }

    closePreview()
    onApplied?.()
    focusGenerator()
  })

  const handleDownload = () => {
    return void saveRecordVideo(record)
  }

  const handleFavorite = () => {
    return void toggleFavorite(record)
  }

  return { availability, friendly, handleDownload, handleFavorite, reference, reuse }
}

/** Timestamps on the left, hover actions on the right, delete dialog for failed records. */
export function DetailsActions(props: DetailsActionsProps) {
  const { record, isActive, now } = props
  const confirmDialog = useBoolean()

  const { availability, friendly, handleDownload, handleFavorite, reference, reuse } =
    useDetailsFooter(props)

  const isFailed = record.status === 'failed'
  const timeNow = isActive ? now : undefined

  return (
    <>
      <div className="relative mt-auto h-6 shrink-0">
        <div className="flex h-6 items-center justify-between text-xs text-fg-2 transition-opacity duration-150 group-hover/card:pointer-events-none group-hover/card:opacity-0 group-has-focus-visible/card:pointer-events-none group-has-focus-visible/card:opacity-0 group-has-data-[state=open]/card:pointer-events-none group-has-data-[state=open]/card:opacity-0">
          <span>{formatDate(record.createdAt)}</span>
          <span className="tabular-nums">{totalTime(record, timeNow)}</span>
        </div>
        <div className="pointer-events-none absolute inset-0 flex h-6 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-focus-visible/card:pointer-events-auto group-has-focus-visible/card:opacity-100 group-has-data-[state=open]/card:pointer-events-auto group-has-data-[state=open]/card:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            className="h-5.5 rounded-md px-4 text-xxs font-semibold text-fg hover:bg-hover"
            onClick={reuse.run}
          >
            Reuse
          </Button>
          {record.status === 'completed' && (
            <Tooltip content={availability.tooltip}>
              <span className="inline-flex">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5.5 rounded-md px-4 text-xxs font-semibold text-fg hover:bg-hover"
                  disabled={availability.isDisabled || reference.isRunning}
                  onClick={reference.run}
                >
                  <ImagePlus size={14} aria-hidden />
                  Reference
                </Button>
              </span>
            </Tooltip>
          )}
          {!isNil(friendly) && (
            <ErrorDetailsPopover
              error={friendly}
              className="h-5.5 rounded-md px-4 text-xxs font-semibold text-fg"
            />
          )}
          <DetailsActionButtons
            record={record}
            onDownload={handleDownload}
            onFavorite={handleFavorite}
          />
          {isFailed && (
            <button
              type="button"
              aria-label="Remove"
              onClick={confirmDialog.on}
              className="ml-auto inline-flex h-6 w-7.5 items-center justify-center rounded-lg text-danger transition hover:bg-danger/10"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
          {!isFailed && (
            <MoreMenu
              record={record}
              onDeleted={props.onDeleted}
              variant="panel"
              className="ml-auto h-6 w-7.5 rounded-lg border-0"
            />
          )}
        </div>
      </div>
      <DeleteConfirm
        record={record}
        open={confirmDialog.value}
        onOpenChange={confirmDialog.set}
        onDeleted={props.onDeleted}
      />
    </>
  )
}
