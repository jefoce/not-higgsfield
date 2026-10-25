import { chunk } from 'lodash-es'
import { toast } from 'sonner'

import { messageOf } from '@/core/errors'
import type { UploadItem } from '@/core/schemas/upload-item'
import { linkAbsPath } from '@/lib/api/uploads'

/** Links paths 3 at a time. One toast per failure, the rest still reach the UI. */
export async function linkPaths(paths: string[]): Promise<UploadItem[]> {
  const items: UploadItem[] = []

  for (const group of chunk(paths, 3)) {
    const results = await Promise.allSettled(group.map((file) => linkAbsPath(file)))

    for (const result of results) {
      if (result.status === 'fulfilled') {
        items.push(result.value)
      } else {
        toast.error(messageOf(result.reason))
      }
    }
  }

  return items
}
