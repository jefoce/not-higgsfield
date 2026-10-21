import { toast } from 'sonner'
import { acceptFiles, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind, UploadItem } from '@/core/types'
import { getPlatform } from './index'
import { linkPaths } from './link-paths'

export interface DropZone {
  kinds: () => readonly MediaKind[]
  extensions?: () => KindExtensions | undefined
  onHover: (over: boolean) => void
  onUploaded: (items: UploadItem[]) => void
}

const zones = new Map<string, DropZone>()
let hovered: string | null = null
let started = false

/** Zones mark their element with data-drop-zone="<id>". */
export function registerDropZone(id: string, zone: DropZone): () => void {
  zones.set(id, zone)
  void start()
  return () => {
    zones.delete(id)
    if (hovered === id) hovered = null
  }
}

/** Innermost zone under the point. */
function zoneAt(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-zone]')
  const id = element?.dataset.dropZone ?? null
  return id && zones.has(id) ? id : null
}

function setHovered(id: string | null): void {
  if (hovered === id) return
  if (hovered) zones.get(hovered)?.onHover(false)
  hovered = id
  if (id) zones.get(id)?.onHover(true)
}

async function start(): Promise<void> {
  if (started) return
  started = true
  const platform = await getPlatform()
  await platform.onFileDrop((event) => {
    if (event.type === 'leave') {
      setHovered(null)
      return
    }
    const id = zoneAt(event.x, event.y)
    setHovered(id)
    if (event.type !== 'drop' || !id) return
    setHovered(null)
    void linkDropped(zones.get(id)!, event.paths)
  })
}

/** A path with an extension is a file candidate, anything else is likely a folder. */
const looksLikeFile = (value: string): boolean => /\.[^\\/]+$/.test(value)

async function linkDropped(zone: DropZone, paths: string[]): Promise<void> {
  const candidates = paths.map((path) => ({ name: path, type: '' }))
  const { accepted, skipped } = acceptFiles({ files: candidates, kinds: zone.kinds(), extensions: zone.extensions?.() })
  const folders = candidates.filter((file) => !looksLikeFile(file.name)).length
  const unsupported = skipped - folders
  if (folders) toast('Folders: use Add folder')
  if (unsupported) toast(`Skipped ${unsupported} unsupported file${unsupported === 1 ? '' : 's'}`)

  const items = await linkPaths(accepted.map((file) => file.name))
  if (items.length) zone.onUploaded(items)
}
