'use client'

import { useEffect, useState } from 'react'
import { ArrowUp, Folder, X } from 'lucide-react'
import useSWR from 'swr'
import { toast } from 'sonner'
import type { FolderItem } from '@/core/types'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { Spinner } from '@/ui/Spinner'
import { Switch } from '@/ui/form/Switch'
import { errorMessage } from '@/lib/errors'
import { getPlatform } from '@/lib/platform'
import { browseDirs, createFolder, fetchSystemCapabilities } from './api'
import type { BrowseResult } from '@/core/types'

export interface AddFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: (folder: FolderItem) => void
}

const NATIVE_LABELS: Record<string, string> = { darwin: 'Finder', win32: 'Explorer' }
const nativeLabel = (platform: string): string => NATIVE_LABELS[platform] ?? 'Files'

function crumbPaths(path: string): { label: string; path: string }[] {
  const parts = path.split('/').filter(Boolean)
  return parts.map((label, index) => ({
    label,
    path: `/${parts.slice(0, index + 1).join('/')}`,
  }))
}

/** Server directory browser used to connect a folder. */
export function AddFolderDialog(props: AddFolderDialogProps) {
  const { open, onOpenChange, onAdded } = props
  const [path, setPath] = useState<string | null>(null)
  const [data, setData] = useState<BrowseResult | null>(null)
  const [hidden, setHidden] = useState(false)
  const [adding, setAdding] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [reload, setReload] = useState(0)
  const { data: capabilities } = useSWR('system-capabilities', fetchSystemCapabilities)

  useEffect(() => {
    if (!open) return
    let alive = true
    browseDirs(path ?? undefined, hidden)
      .then((result) => alive && setData(result))
      .catch((error) => alive && toast.error(errorMessage(error)))
    return () => {
      alive = false
    }
  }, [open, path, hidden, reload])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPath(null)
      setData(null)
    }
    onOpenChange(next)
  }

  const navigate = (next: string) => {
    setData(null)
    setPath(next)
    setReload((value) => value + 1)
  }

  const add = async () => {
    if (!data) return
    setAdding(true)
    try {
      const folder = await createFolder(data.path)
      toast.success('Folder connected')
      onAdded(folder)
      handleOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setAdding(false)
    }
  }

  const chooseNative = async () => {
    setChoosing(true)
    try {
      const folder = await (await getPlatform()).chooseFolder()
      if (!folder) return
      toast.success('Folder connected')
      onAdded(folder)
      handleOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setChoosing(false)
    }
  }

  const crumbs = crumbPaths(data?.path ?? path ?? '')

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      label="Add folder"
      className="flex h-[min(560px,80vh)] max-h-none w-[min(600px,92vw)] flex-col rounded-2xl border border-line-strong bg-page-2 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-fg-2">Add folder</h2>
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full text-fg-2 transition hover:bg-white/5 hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex h-10 min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg bg-surface px-3 font-mono text-xs text-fg-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="shrink-0 transition hover:text-fg"
        >
          /
        </button>
        {crumbs.map((crumb) => (
          <span key={crumb.path} className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => navigate(crumb.path)}
              className="max-w-32 truncate transition hover:text-fg"
            >
              {crumb.label}
            </button>
            <span>/</span>
          </span>
        ))}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {!data && (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        )}

        {Boolean(data?.parent) && (
          <button
            type="button"
            onClick={() => navigate(data?.parent ?? '/')}
            className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-fg-2 transition hover:bg-white/5 hover:text-fg"
          >
            <ArrowUp className="h-4 w-4" />
            ..
          </button>
        )}

        {data?.dirs.map((dir) => (
          <button
            key={dir.path}
            type="button"
            onClick={() => navigate(dir.path)}
            className="flex h-10 w-full items-center gap-2 truncate rounded-lg px-2 text-left text-sm transition hover:bg-white/5"
          >
            <Folder className="h-4 w-4 shrink-0 text-fg-2" aria-hidden />
            <span className="truncate">{dir.name}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!!capabilities?.chooseFolder && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs"
              loading={choosing}
              onClick={() => void chooseNative()}
            >
              {`Choose in ${nativeLabel(capabilities.platform)}`}
            </Button>
          )}
          <Switch
            id="show-hidden"
            checked={hidden}
            onCheckedChange={(next) => {
              setData(null)
              setHidden(next)
            }}
            label="Show hidden"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-9 text-xs"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="h-9 text-xs"
            loading={adding}
            disabled={!data}
            onClick={() => void add()}
          >
            Add this folder
          </Button>
        </div>
      </div>
    </Modal>
  )
}
