'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/cn'

interface StageNavButtonProps {
  side: 'left' | 'right'
  disabled: boolean
  onClick: () => void
  revealOnHover?: boolean
}

const REVEAL_CLASSES =
  'pointer-events-none opacity-0 group-hover/stage:pointer-events-auto group-hover/stage:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'

/** Round previous/next control on a media stage. */
export function StageNavButton(props: StageNavButtonProps) {
  const { side, disabled: isDisabled, revealOnHover: isRevealOnHover = false } = props
  const isLeft = side === 'left'
  const Icon = isLeft ? ChevronLeft : ChevronRight
  const label = isLeft ? 'Previous' : 'Next'

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={props.onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-fg backdrop-blur-sm transition hover:bg-black/80 disabled:opacity-30',
        isLeft && 'left-4',
        !isLeft && 'right-4',
        isRevealOnHover && REVEAL_CLASSES,
      )}
    >
      <Icon size={20} aria-hidden />
    </button>
  )
}
