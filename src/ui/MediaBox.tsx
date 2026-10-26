import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface MediaBoxProps {
  aspect: string
  children: ReactNode
}

/** CSS ratio form of `16/9`, `16:9` or `16 / 9`. */
function ratioOf(aspect: string): string {
  return aspect.replace(':', '/')
}

function aspectValue(aspect: string): number {
  const [width, height] = ratioOf(aspect).split('/').map(Number)

  return (width ?? 0) / (height ?? 0)
}

/**
 * Box sized from a media aspect, so the stage backdrop shows around it.
 * @public
 */
export function MediaBox(props: MediaBoxProps) {
  const { aspect, children } = props
  const sizeClass = aspectValue(aspect) >= 1 ? 'w-full' : 'h-full'

  return (
    <div
      style={{ aspectRatio: ratioOf(aspect) }}
      className={cn('max-h-full max-w-full overflow-hidden rounded-xl', sizeClass)}
    >
      <div className="size-full">{children}</div>
    </div>
  )
}
