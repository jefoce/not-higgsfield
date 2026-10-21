'use client'

import { Plus, X } from 'lucide-react'
import type { FolderItem } from '@/core/types'
import { cn } from '@/lib/cn'

export interface PickerTabsProps {
  folders: FolderItem[]
  activeTab: string
  onTabChange: (tab: string) => void
  onAddFolder: () => void
  onDisconnectFolder: (folderId: string) => void
  onClose: () => void
}

function tabClass(active: boolean): string {
  return cn(
    'flex h-9 shrink-0 items-center rounded-lg px-4 text-xs font-medium transition',
    active ? 'bg-fg text-page' : 'text-fg hover:bg-white/5',
  )
}

/** Scrollable pill tabs for uploads and connected folders. */
export function PickerTabs(props: PickerTabsProps) {
  const {
    folders,
    activeTab,
    onTabChange,
    onAddFolder,
    onDisconnectFolder,
    onClose,
  } = props
  return (
    <div className="flex h-12 shrink-0 items-center gap-2">
      <div className="flex flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          className={tabClass(activeTab === 'uploads')}
          onClick={() => onTabChange('uploads')}
        >
          Uploads
        </button>

        {folders.map((folder) => (
          <div key={folder.id} className="group relative shrink-0">
            <button
              type="button"
              className={cn(tabClass(activeTab === folder.id), 'max-w-40 pr-8')}
              onClick={() => onTabChange(folder.id)}
            >
              <span className="truncate">{folder.name}</span>
            </button>
            <button
              type="button"
              aria-label={`Disconnect ${folder.name}`}
              onClick={(event) => {
                event.stopPropagation()
                onDisconnectFolder(folder.id)
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-fg-2 opacity-0 transition hover:bg-white/10 hover:text-fg group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddFolder}
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-xs text-fg-2 transition hover:bg-white/5 hover:text-fg"
        >
          <Plus className="h-4 w-4" />
          Add folder
        </button>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close picker"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-2 transition hover:bg-white/5 hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
