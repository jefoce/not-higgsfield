'use client'

import { useState, type ReactNode } from 'react'
import { Copy, Film, FolderOpen, Frame, Hash, MoreHorizontal, Trash2 } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { toast } from 'sonner'
import { getPreset } from '@/core/presets'
import { canCancelInGrace } from '@/core/submit-state'
import type { GenerationRecord, UploadItem } from '@/core/types'
import { useGeneratorStore } from '@/features/generator/store'
import { apiPost } from '@/lib/fetcher'
import { cn } from '@/lib/cn'
import { DeleteConfirm } from './DeleteConfirm'
import { errorMessage } from '@/lib/errors'
import { plainPrompt } from './record-view'
import { cancelGeneration } from './record-actions'

const ROUND =
  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70'

const ITEM =
  'flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg px-2 text-sm font-medium leading-5 tracking-[0.00625rem] outline-none data-[highlighted]:bg-hover'

interface RowProps {
  children: ReactNode
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
}

function Row(props: RowProps) {
  const { children, icon, onSelect, disabled, destructive } = props
  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(ITEM, destructive ? 'text-danger data-[highlighted]:bg-danger/10' : 'text-fg')}
    >
      <span className={cn('flex shrink-0 items-center', destructive ? 'text-danger' : 'text-fg-2')}>
        {icon}
      </span>
      {children}
    </DropdownMenuPrimitive.Item>
  )
}

interface MoreMenuProps {
  record: GenerationRecord
  onDeleted?: () => void
  className?: string
  variant?: 'overlay' | 'panel'
}

/** Record actions: frame capture, reference copy, clipboard, reveal, delete. */
export function MoreMenu(props: MoreMenuProps) {
  const { record, onDeleted, className, variant = 'overlay' } = props
  const [confirmOpen, setConfirmOpen] = useState(false)
  const completed = record.status === 'completed'
  const videoRefsFull = getPreset(record.preset.id).references.video === 0

  const captureFrame = async (at: 'first' | 'last') => {
    try {
      const upload = await apiPost<UploadItem>(`/api/generations/${record.id}/frame`, { at })
      const store = useGeneratorStore.getState()
      store.setTab('frames')
      store.setFrame('start', upload)
      toast.success('Start frame set')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const addReference = async () => {
    try {
      const upload = await apiPost<UploadItem>('/api/uploads/link', { generationId: record.id })
      const store = useGeneratorStore.getState()
      store.setTab('references')
      store.addReferences([upload])
      if (useGeneratorStore.getState().references.includes(upload.id)) toast.success('Added as reference')
      else toast.error('Reference limit reached')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(plainPrompt(record))
      toast.success('Prompt copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  const copySeed = async () => {
    const seed = record.seedUsed ?? record.input.seed
    if (seed == null) {
      toast.error('No seed recorded')
      return
    }
    try {
      await navigator.clipboard.writeText(String(seed))
      toast.success('Seed copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  const remove = () => {
    if (canCancelInGrace(record)) {
      void cancelGeneration(record.id)
      return
    }
    setConfirmOpen(true)
  }

  const reveal = async () => {
    try {
      await apiPost(`/api/generations/${record.id}/reveal`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="More actions"
            data-card-menu
            className={cn(
              variant === 'panel'
                ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-2 transition hover:bg-hover'
                : ROUND,
              className,
            )}
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={6}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className="z-50 min-w-52 rounded-xl bg-page-2 p-2 shadow-[0_0_0_1px_var(--color-hover)]"
          >
            <Row icon={<Frame size={14} aria-hidden />} disabled={!completed} onSelect={() => void captureFrame('last')}>
              Use last frame as start frame
            </Row>
            <Row icon={<Frame size={14} aria-hidden />} disabled={!completed} onSelect={() => void captureFrame('first')}>
              Use first frame as start frame
            </Row>
            <Row
              icon={<Film size={14} aria-hidden />}
              disabled={!completed || videoRefsFull}
              onSelect={() => void addReference()}
            >
              Add video as reference
            </Row>
            <DropdownMenuPrimitive.Separator className="my-1 h-px bg-divider" />
            <Row icon={<Copy size={14} aria-hidden />} onSelect={() => void copyPrompt()}>Copy prompt</Row>
            <Row icon={<Hash size={14} aria-hidden />} onSelect={() => void copySeed()}>Copy seed</Row>
            <Row icon={<FolderOpen size={14} aria-hidden />} disabled={!completed} onSelect={() => void reveal()}>
              Reveal in Finder
            </Row>
            <DropdownMenuPrimitive.Separator className="my-1 h-px bg-divider" />
            <Row icon={<Trash2 size={14} aria-hidden />} destructive onSelect={remove}>
              Delete
            </Row>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
      <DeleteConfirm
        record={record}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDeleted={onDeleted}
      />
    </>
  )
}
