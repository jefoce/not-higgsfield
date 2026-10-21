'use client'

import { useEffect, useState } from 'react'
import { Clock, Copy, Diamond, Download, Heart, Ratio, Trash2, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { ACTIVE_STATUSES, type GenerationRecord } from '@/core/types'
import { formatDate, formatSecondsShort } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { Tooltip } from '@/ui/Tooltip'
import { DeleteConfirm } from './DeleteConfirm'
import { ErrorDetailsPopover } from './ErrorDetailsPopover'
import { InputThumbs } from './InputThumbs'
import { MoreMenu } from './MoreMenu'
import { canonicalPrompt, recordError } from './record-view'
import { rerunRecord, saveRecordVideo, toggleFavorite } from './record-actions'
import { costInfo, totalTime } from './details-info'
import { PromptText } from './PromptText'

const SETTING =
  'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-lg bg-surface py-[5px] pl-1.5 pr-2.5 text-xxs font-semibold text-fg'

interface DetailsPanelProps {
  record: GenerationRecord
  onDeleted?: () => void
}

/** Prompt, inputs, settings, actions and cost for one record. */
export function DetailsPanel(props: DetailsPanelProps) {
  const { record, onDeleted } = props
  const AudioIcon = record.input.audio ? Volume2 : VolumeX
  const plain = canonicalPrompt(record)
  const cost = costInfo(record)
  const aspect = record.input.aspectRatio === 'auto' ? 'Auto' : record.input.aspectRatio
  const active = ACTIVE_STATUSES.includes(record.status)
  const failed = record.status === 'failed'
  const [now, setNow] = useState(() => Date.now())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const friendly = failed ? recordError(record) : null

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [active])

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-page-2 p-3 pb-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-6 min-w-0 items-center truncate rounded-lg border border-divider bg-transparent pl-1.5 pr-2 text-xxs font-semibold text-fg">
          {record.preset.title}
        </span>
        <Tooltip content={cost.note}>
          <span className="inline-flex h-6 min-w-0 items-center truncate rounded-lg border border-divider bg-transparent pl-1.5 pr-2 text-xxs font-semibold text-fg">
            {cost.text}
          </span>
        </Tooltip>
      </div>

      <div className="flex min-h-0 shrink flex-col">
        <div className="flex h-6 items-center justify-between">
          <span className="text-xs leading-[18px] text-fg-2">Prompt</span>
          <button type="button" aria-label="Copy prompt" onClick={() => void copyText(plain, 'Prompt')}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-2 transition hover:bg-hover hover:text-fg">
            <Copy size={13} aria-hidden />
          </button>
        </div>
        {plain ? (
          <div className="max-h-40 min-h-0 overflow-y-auto">
            <p className="whitespace-pre-wrap pt-1 text-sm text-fg-2">
              <PromptText prompt={plain} record={record} />
            </p>
          </div>
        ) : (
          <p className="pt-1 text-sm text-fg-2">No prompt</p>
        )}
      </div>

      <InputThumbs record={record} />

      <div className="flex flex-wrap gap-2">
        <span className={SETTING}>
          <Diamond size={14} className="text-fg-2" aria-hidden />
          {record.input.resolution}
        </span>
        <span className={SETTING}>
          <Clock size={14} className="text-fg-2" aria-hidden />
          {formatSecondsShort(record.output?.durationSec ?? record.input.duration)}
        </span>
        <span className={SETTING}>
          <Ratio size={14} className="text-fg-2" aria-hidden />
          {aspect}
        </span>
        <span className={SETTING}>
          <AudioIcon size={14} className="text-fg-2" aria-hidden />
          {record.input.audio ? 'Audio on' : 'Audio off'}
        </span>
      </div>

      <div className="relative mt-auto h-6 shrink-0">
        <div className="flex h-6 items-center justify-between text-xs text-fg-2 transition-opacity duration-150 group-hover/card:pointer-events-none group-hover/card:opacity-0 group-has-[:focus-visible]/card:pointer-events-none group-has-[:focus-visible]/card:opacity-0 group-has-[[data-state=open]]/card:pointer-events-none group-has-[[data-state=open]]/card:opacity-0">
          <span>{formatDate(record.createdAt)}</span>
          <span className="tabular-nums">{totalTime(record, active ? now : undefined)}</span>
        </div>
        <div className="pointer-events-none absolute inset-0 flex h-6 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100 group-has-[[data-state=open]]/card:pointer-events-auto group-has-[[data-state=open]]/card:opacity-100">
          <Button size="sm" variant="ghost" className="h-[22px] rounded-md px-4 text-[10px] font-semibold text-fg hover:bg-hover"
            onClick={() => void rerunRecord(record)}>
            Reuse
          </Button>
          {friendly !== null && (
            <ErrorDetailsPopover
              error={friendly}
              className="h-[22px] rounded-md px-4 text-[10px] font-semibold text-fg"
            />
          )}
          {record.status === 'completed' && (
            <Tooltip content="Download">
              <button type="button" onClick={() => void saveRecordVideo(record)} aria-label="Download"
                className="inline-flex h-6 w-[30px] items-center justify-center rounded-lg text-fg-2 transition hover:bg-hover">
                <Download size={14} aria-hidden />
              </button>
            </Tooltip>
          )}
          {record.status !== 'failed' && (
            <Tooltip content={record.favorite ? 'Remove favorite' : 'Favorite'}>
              <button type="button" aria-label={record.favorite ? 'Remove favorite' : 'Favorite'}
                onClick={() => void toggleFavorite(record)}
                className={cn('inline-flex h-6 w-[30px] items-center justify-center rounded-lg text-fg-2 transition hover:bg-hover', record.favorite && 'text-favorite')}>
                <Heart size={14} className={cn(record.favorite && 'fill-current')} aria-hidden />
              </button>
            </Tooltip>
          )}
          {failed ? (
            <button type="button" aria-label="Remove" onClick={() => setConfirmOpen(true)}
              className="ml-auto inline-flex h-6 w-[30px] items-center justify-center rounded-lg text-danger transition hover:bg-danger/10">
              <Trash2 size={14} aria-hidden />
            </button>
          ) : (
            <MoreMenu record={record} onDeleted={onDeleted} variant="panel" className="ml-auto h-6 w-[30px] rounded-lg border-0" />
          )}
        </div>
      </div>
      <DeleteConfirm record={record} open={confirmOpen} onOpenChange={setConfirmOpen} onDeleted={onDeleted} />
    </div>
  )
}
