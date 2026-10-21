'use client'

import { useEffect, useState } from 'react'
import { Download, Heart, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { GenerationRecord } from '@/core/types'
import { errorMessage } from '@/lib/errors'
import { platform } from '@/lib/platform'
import { cn } from '@/lib/cn'
import { useSelectionStore } from './selection-store'
import { batchAction } from './batch-actions'
import { SelectionStack } from './SelectionStack'
import { revalidateHistory } from './use-history'

const BUTTON =
  'inline-flex h-10 items-center justify-center rounded-xl bg-white/5 text-sm font-medium text-fg transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40'

const MIXED_TITLE = 'Only finished videos can be downloaded or liked.'

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

interface SelectionBarProps {
  records: GenerationRecord[]
}

/** Floating batch actions for the current selection. */
export function SelectionBar(props: SelectionBarProps) {
  const { records } = props
  const ids = useSelectionStore((state) => state.ids)
  const clear = useSelectionStore((state) => state.clear)
  const [busy, setBusy] = useState<'like' | 'delete' | 'download' | null>(null)

  const selected = records.filter((record) => ids.has(record.id))
  const active = ids.size > 0

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('[role="dialog"],[role="menu"]')) return
      clear()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [clear])

  const byId = new Map(records.map((record) => [record.id, record]))
  const stack = [...ids].slice(-3).reverse()

  const allCompleted = selected.length > 0 && selected.every((record) => record.status === 'completed')
  const allLiked = selected.every((record) => record.favorite)
  const likeLabel = allLiked ? 'Unlike selected videos' : 'Like selected videos'
  const downloadTitle = allCompleted ? 'Download selected videos' : MIXED_TITLE
  const likeTitle = allCompleted ? likeLabel : MIXED_TITLE

  const download = async () => {
    if (!allCompleted) return
    setBusy('download')
    try {
      if (selected.length === 1) {
        const saved = await platform.saveVideo(selected[0]!)
        if (!saved) return
        toast.success('Video saved')
      } else {
        const result = await platform.saveVideos(selected)
        if (!result.saved) return
        if (result.folder) {
          toast.success(`${plural(result.saved, 'video')} saved to ${result.folder}`)
        } else {
          toast.success(
            result.saved === 1
              ? 'Download started'
              : `${result.saved} downloads started. Allow multiple downloads if asked.`,
          )
        }
      }
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const like = async () => {
    setBusy('like')
    try {
      const favorite = !allLiked
      const result = await batchAction(
        selected.map((record) => record.id),
        { action: 'favorite', favorite },
      )
      toast.success(favorite ? `Liked ${result.done.length}` : `Unliked ${result.done.length}`)
      await revalidateHistory()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    const count = selected.length
    const ok = await platform.confirm(
      `Delete ${count} video${count === 1 ? '' : 's'}? The files are removed from your computer.`,
    )
    if (!ok) return
    setBusy('delete')
    try {
      const result = await batchAction(
        selected.map((record) => record.id),
        { action: 'delete' },
      )
      const skippedActive = result.skipped.filter((item) => item.reason === 'active').length
      const skippedText = `${skippedActive} still generating ${skippedActive === 1 ? 'was' : 'were'} skipped`
      if (!result.done.length) {
        toast.error(skippedActive ? `Nothing deleted. ${skippedText}.` : 'Nothing deleted')
      } else {
        toast.success(
          skippedActive
            ? `Deleted ${result.done.length}. ${skippedText}.`
            : `Deleted ${result.done.length}`,
        )
      }
      clear()
      await revalidateHistory()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      role="toolbar"
      aria-label="Selected videos"
      aria-hidden={!active}
      className={cn(
        'absolute bottom-6 left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-line-strong bg-surface-2/95 p-2 shadow-selection backdrop-blur transition duration-150 ease-out motion-reduce:transition-none',
        active ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        !active && 'pointer-events-none',
      )}
    >
      <SelectionStack stack={stack} byId={byId} />

      <span aria-live="polite" className="w-[96px] shrink-0 whitespace-nowrap text-sm font-medium tabular-nums text-fg">
        {ids.size} selected
      </span>

      <button
        type="button"
        className={cn(BUTTON, 'gap-1.5 px-3.5')}
        disabled={!allCompleted || busy !== null}
        onClick={() => void download()}
        title={downloadTitle}
      >
        <Download size={15} aria-hidden />
        Download
      </button>

      <button
        type="button"
        className={cn(BUTTON, 'w-10')}
        disabled={!allCompleted || busy !== null}
        onClick={() => void like()}
        aria-label={likeLabel}
        title={likeTitle}
      >
        <Heart size={15} className={cn(allLiked && 'fill-current text-favorite')} aria-hidden />
      </button>

      <button
        type="button"
        className={cn(BUTTON, 'w-10')}
        disabled={busy !== null}
        onClick={() => void remove()}
        aria-label="Delete selected videos"
        title="Delete selected videos"
      >
        <Trash2 size={15} aria-hidden />
      </button>

      <button
        type="button"
        aria-label="Clear selection"
        title="Clear selection"
        onClick={clear}
        className={cn(BUTTON, 'w-10')}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}
