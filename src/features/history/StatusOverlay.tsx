'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Ban } from 'lucide-react'
import { SUBMIT_GRACE_MS } from '@/core/constants'
import { MODEL_PRESETS } from '@/core/presets'
import { formatEstimate } from '@/core/pricing'
import { STATUS_HELP, statusHelpKey, statusHelpText } from '@/core/status-help'
import { graceDelayMs } from '@/core/submit-state'
import { ACTIVE_STATUSES, type GenerationRecord, type JobStatus } from '@/core/types'
import { formatElapsed } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { Spinner } from '@/ui/Spinner'
import { Tooltip } from '@/ui/Tooltip'
import { ErrorDetailsPopover } from './ErrorDetailsPopover'
import { rerunRecord } from './record-actions'
import { recordAspect, recordError } from './record-view'
import { SelectionCheckbox } from './SelectionCheckbox'
import { useSelectionItem } from './use-selection-item'

type Tone = 'lime' | 'gray' | 'red'

const TONES: Record<JobStatus, Tone> = {
  submitting: 'gray',
  pending: 'gray',
  in_progress: 'lime',
  completed: 'gray',
  failed: 'red',
  cancelled: 'red',
  expired: 'red',
}

const CANCELLED_TEXT = 'Not sent, not charged.'

const TONE_TEXT: Record<Tone, string> = {
  lime: 'text-lime',
  gray: 'text-fg-2',
  red: 'text-danger',
}

const RING_RADIUS = 10
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

const PILL =
  'inline-flex h-9 max-w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-line px-3 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--color-line)] backdrop-blur-sm'

const PILL_COMPACT = 'h-7 gap-1.5 px-2 text-xs'

function statusLabel(record: GenerationRecord): string {
  const base = STATUS_HELP[statusHelpKey(record)].label
  const progress = record.submit?.stage === 'uploading' ? record.submit.progress : undefined
  return progress == null ? base : `${base} ${progress}%`
}

interface GlowLayersProps {
  tone: Tone
}

function GlowLayers(props: GlowLayersProps) {
  const { tone } = props
  return (
    <>
      {(['lime', 'gray', 'red'] as const).map((name) => (
        <div
          key={name}
          aria-hidden
          className={`glow glow-${name} pointer-events-none absolute inset-0 transition-opacity duration-[600ms]`}
          style={{ opacity: tone === name ? 1 : 0 }}
        />
      ))}
    </>
  )
}

interface CountdownRingProps {
  fraction: number
}

function CountdownRing(props: CountdownRingProps) {
  const { fraction } = props
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="pointer-events-none absolute -inset-1 h-6 w-6 -rotate-90"
    >
      <circle cx="12" cy="12" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <circle
        cx="12"
        cy="12"
        r={RING_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - fraction)}
      />
    </svg>
  )
}

interface StatusOverlayProps {
  record: GenerationRecord
  compact?: boolean
  boxAspect?: string
  fill?: boolean
  onCancel?: () => void
}

/** Placeholder for non-completed records: status pill, glow, timer and cost. */
export function StatusOverlay(props: StatusOverlayProps) {
  const {
    record,
    compact = false,
    boxAspect,
    fill = false,
    onCancel,
  } = props
  const key = statusHelpKey(record)
  const help = STATUS_HELP[key]
  const stage = record.submit?.stage
  const grace = record.status === 'submitting' && stage === 'grace'
  const active = ACTIVE_STATUSES.includes(record.status)
  const { selecting } = useSelectionItem(record.id)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    const tick = () => {
      if (!document.hidden) setNow(Date.now())
    }
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [active])

  const label = statusLabel(record)
  const tone: Tone = stage || record.download ? 'gray' : TONES[record.status]
  const red = tone === 'red'
  const friendly = recordError(record)
  const realPersonPreset = friendly?.kind === 'real_person'
    ? MODEL_PRESETS.find((preset) => preset.contentPolicy.realPeople === 'allowed')
    : undefined
  const line = friendly?.hint ?? (record.status === 'cancelled' ? CANCELLED_TEXT : null)
  const ringFraction = grace
    ? Math.min(1, Math.max(0, graceDelayMs(record.submit?.notBefore, now) / SUBMIT_GRACE_MS))
    : 0

  const from = TONES[record.status] === 'lime' ? record.job?.startedAt ?? record.createdAt : record.createdAt
  const spinnerClass = tone === 'gray' ? '[animation-duration:1.6s]' : undefined
  const boxStyle = fill ? undefined : { aspectRatio: boxAspect ?? recordAspect(record), margin: '0 auto' }

  const pill = (
    <Tooltip content={statusHelpText(help)}>
      <div tabIndex={0} className={cn(PILL, TONE_TEXT[tone], compact && PILL_COMPACT)}>
        {red ? (
          <AlertCircle size={16} className="shrink-0" aria-hidden />
        ) : (
          <span className="relative flex shrink-0 items-center justify-center">
            {Boolean(grace) && <CountdownRing fraction={ringFraction} />}
            <Spinner
              size={16}
              tone={tone === 'lime' ? 'lime' : 'muted'}
              className={spinnerClass}
            />
          </span>
        )}
        <span className="min-w-0 truncate">{label}</span>
      </div>
    </Tooltip>
  )

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl bg-surface', fill && 'h-full w-full')}
      style={boxStyle}
    >
      <GlowLayers tone={tone} />

      {red ? (
        <div className={cn('absolute z-30', compact ? 'left-3 top-3' : 'left-4 top-4')}>
          <div
            className={cn(
              'transition-opacity duration-150',
              selecting
                ? 'pointer-events-none opacity-0'
                : 'group-hover/card:pointer-events-none group-hover/card:opacity-0 group-has-[:focus-visible]/card:pointer-events-none group-has-[:focus-visible]/card:opacity-0',
            )}
          >
            {pill}
          </div>
          <SelectionCheckbox id={record.id} className={compact ? 'left-1.5 top-1' : 'left-2.5 top-2'} />
        </div>
      ) : (
        <div
          className={cn(
            'absolute inset-x-4 top-4 z-10 flex flex-col gap-3 pl-7',
            compact && 'inset-x-3 top-3',
          )}
        >
          <div className={cn('flex flex-wrap items-start gap-2', compact && 'gap-1.5')}>
            {pill}

            {Boolean(grace) && onCancel !== undefined && (
              <button
                type="button"
                onClick={() => onCancel()}
                className={cn(PILL, 'ml-auto text-fg transition-colors hover:bg-white/10', compact && PILL_COMPACT)}
              >
                <Ban size={16} className="shrink-0" aria-hidden />
                <span className="min-w-0 truncate">Cancel</span>
              </button>
            )}
          </div>

          {!compact && Boolean(active) && (
            <div className="flex items-center gap-2 text-xs text-fg-2">
              {!grace && <span>{formatElapsed(from, now)}</span>}
              <span>{formatEstimate(record.cost.estimatedUsd)}</span>
            </div>
          )}
        </div>
      )}

      {!compact && Boolean(red) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 pt-14 text-center">
          <p className="line-clamp-2 text-danger">{friendly?.title ?? help.label}</p>
          {line !== null && <p className="line-clamp-3 text-sm text-fg-2">{line}</p>}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void rerunRecord(record)}>
              Reuse
            </Button>
            {realPersonPreset !== undefined && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void rerunRecord(record, realPersonPreset.id)}
              >
                Reuse with {realPersonPreset.title}
              </Button>
            )}
            {friendly !== null && <ErrorDetailsPopover error={friendly} />}
          </div>
        </div>
      )}
    </div>
  )
}
