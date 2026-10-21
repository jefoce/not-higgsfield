'use client'

import { forwardRef } from 'react'
import Image from 'next/image'
import type { BeautifulMentionsMenuItemProps } from 'lexical-beautiful-mentions'
import { cn } from '@/lib/cn'
import { ReferenceIcon } from './ReferenceIcon'

/** One typeahead row: thumb plus slot label. */
export const ReferencePickerMenuItem = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(
  function ReferencePickerMenuItem(props, ref) {
    const { selected, item, className, onClick, onMouseDown, onMouseEnter, tabIndex } = props
    const thumb = item.data?.thumb
    const kind = item.data?.kind
    const thumbSrc = typeof thumb === 'string' ? thumb : null
    return (
      <li
        ref={ref}
        tabIndex={tabIndex}
        role="menuitem"
        data-selected={selected || undefined}
        aria-label={`Choose ${item.displayValue}`}
        onClick={onClick}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        className={cn(
          'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg p-2 text-sm font-medium text-fg hover:bg-white/5',
          selected && 'bg-white/10 text-lime',
          className,
        )}
      >
        {thumbSrc ? (
          <Image
            src={thumbSrc}
            alt=""
            width={24}
            height={24}
            unoptimized
            className="h-6 w-6 rounded object-cover"
          />
        ) : (
          <ReferenceIcon kind={kind === 'video' || kind === 'audio' ? kind : 'image'} size={14} />
        )}
        <span className="shrink-0 font-medium">{item.displayValue}</span>
      </li>
    )
  },
)
