'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface UploadProgressItem {
  id: string
  file: File
  progress: number
  error?: string
}

export interface UploadProgressTileProps {
  item: UploadProgressItem
  onRetry?: () => void
  onDismiss?: () => void
}

interface ProgressRingProps {
  value: number
}

function ProgressRing(props: ProgressRingProps) {
  const { value } = props
  const percent = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <span className="relative flex h-9 w-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-white/10" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${percent} 100`}
          className="stroke-lime transition-[stroke-dasharray]"
        />
      </svg>
      <span className="text-xxs font-medium tabular-nums text-fg">{percent}%</span>
    </span>
  )
}

/** Dashed placeholder for a file being copied into app storage. */
export function UploadProgressTile(props: UploadProgressTileProps) {
  const { item, onRetry, onDismiss } = props
  const content = item.error ? (
    <>
      <span className="line-clamp-2 break-all text-xxs text-danger">{item.file.name}</span>
      <span className="text-xxs text-danger">Failed</span>
      <div className="flex items-center gap-1">
        {!!onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded px-1.5 py-0.5 text-xxs font-medium text-fg transition hover:bg-white/10"
          >
            Retry
          </button>
        )}
        {!!onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss upload"
            className="rounded p-0.5 text-fg-2 transition hover:bg-white/10 hover:text-fg"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </>
  ) : (
    <>
      <ProgressRing value={item.progress} />
      <span className="line-clamp-2 break-all text-xxs text-fg-2">{item.file.name}</span>
    </>
  )
  return (
    <div
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-divider bg-white/[0.02] p-2 text-center',
        item.error && 'border-danger/50 bg-danger/10',
      )}
    >
      {content}
    </div>
  )
}
