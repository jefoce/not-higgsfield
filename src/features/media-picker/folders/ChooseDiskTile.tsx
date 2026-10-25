'use client'

import { isEmpty } from 'lodash-es'
import { FolderOpen } from 'lucide-react'
import { toast } from 'sonner'

import { messageOf } from '@/core/errors'
import type { KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'
import { getPlatform } from '@/lib/platform'
import { useAsyncAction } from '@/lib/use-async-action'
import { Spinner } from '@/ui/Spinner'

interface ChooseDiskTileProps {
  kinds: MediaKind[]
  max: number
  extensions?: KindExtensions
  onUploaded: (items: UploadItem[]) => void
}

/** Native file picker tile for desktop builds. */
export function ChooseDiskTile(props: ChooseDiskTileProps) {
  const { kinds, max, extensions } = props

  const pickFiles = async (): Promise<void> => {
    try {
      const items = await (
        await getPlatform()
      ).chooseFiles({ kinds, multiple: max > 1, extensions })

      if (isEmpty(items)) {
        return
      }

      props.onUploaded(items)
    } catch (error) {
      toast.error(messageOf(error))
    }
  }

  const { isRunning: isBusy, run } = useAsyncAction(pickFiles)

  const handlePick = () => void run()

  const label = isBusy ? 'Choosing...' : 'Choose from disk'

  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={handlePick}
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-divider bg-white/2 text-xs font-medium text-fg-2 transition hover:bg-white/4 disabled:opacity-60"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-white/10">
        {isBusy && <Spinner size={16} />}
        {!isBusy && <FolderOpen className="size-5" aria-hidden />}
      </span>
      <span>{label}</span>
    </button>
  )
}
