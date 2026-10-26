'use client'

import { type SyntheticEvent, useState } from 'react'
import { isNil } from 'lodash-es'
import { AlertTriangle } from 'lucide-react'

import { LazyVideo } from '@/features/player/LazyVideo'
import type { SeekKeys } from '@/features/player/use-player-input'
import { mediaUrl, thumbUrl } from '@/lib/api/media-urls'
import { MediaBox } from '@/ui/MediaBox'

import type { PreviewItem } from './preview-store'
import { PreviewAudio } from './PreviewAudio'

interface PreviewBodyProps {
  item: PreviewItem | undefined
  playerId: string
  seekKeys?: SeekKeys
  autoPlay?: boolean
}

/** Upload size when both sides are positive, else `fallback`. */
function itemAspect(item: PreviewItem, fallback = '16/9'): string {
  const { width, height } = item

  if (!isNil(width) && !isNil(height) && width > 0 && height > 0) {
    return `${width}/${height}`
  }

  return fallback
}

/** Full-size video, audio or image for the current preview item. */
export function PreviewBody(props: PreviewBodyProps) {
  const { item, playerId, seekKeys, autoPlay: isAutoPlay } = props
  const [naturalAspect, setNaturalAspect] = useState<string>()

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget

    if (naturalWidth > 0 && naturalHeight > 0) {
      setNaturalAspect(`${naturalWidth}/${naturalHeight}`)
    }
  }

  if (!item || item.missing === true) {
    return (
      <MediaBox aspect="16/9">
        <div className="flex size-full flex-col items-center justify-center gap-2 text-sm text-danger">
          <AlertTriangle size={24} aria-hidden />
          File missing
        </div>
      </MediaBox>
    )
  }

  const ref = item.previewRef ?? `uploads/${item.id}`
  const mime = item.kind === 'image' ? undefined : item.mime
  const src = mediaUrl(ref, mime)

  if (item.kind === 'video') {
    return (
      <MediaBox aspect={itemAspect(item)}>
        <LazyVideo
          id={playerId}
          src={src}
          poster={thumbUrl({ ref, w: 960 })}
          alt={item.originalName}
          seekKeys={seekKeys}
          autoPlay={isAutoPlay}
          className="size-full"
        />
      </MediaBox>
    )
  }

  if (item.kind === 'audio') {
    return <PreviewAudio item={item} src={src} />
  }

  return (
    <MediaBox aspect={itemAspect(item, naturalAspect)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- full original, not a thumb */}
      <img
        src={src}
        alt={item.originalName}
        className="size-full object-cover"
        onLoad={handleImageLoad}
      />
    </MediaBox>
  )
}
