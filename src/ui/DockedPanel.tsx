'use client'

import { type ReactNode, type RefObject, useEffect, useState } from 'react'
import { isNil } from 'lodash-es'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/use-media-query'
import { Modal } from '@/ui/Modal'

const WIDE_QUERY = '(min-width: 900px)'
const MAX_PANEL_WIDTH = 560
const EDGE_GAP = 16

const PANEL_CLASSES =
  'z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-page-2/85 p-2 shadow-[0_24px_60px_-20px_var(--color-backdrop)] backdrop-blur-xl outline-none'

const MODAL_CLASSES =
  'flex h-[min(720px,85vh)] max-h-none w-[min(900px,90vw)] flex-col bg-page-2 p-2 max-compact:w-[calc(100vw-16px)]'

interface PanelSize {
  width: number
  height: number
}

interface DockedPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorRef: RefObject<HTMLElement | null>
  fallback?: 'modal'
  label: string
  children: ReactNode
  className?: string
}

function measureAnchor(anchor: HTMLElement): PanelSize {
  const rect = anchor.getBoundingClientRect()

  return {
    width: Math.min(MAX_PANEL_WIDTH, window.innerWidth - rect.right - EDGE_GAP),
    height: rect.height,
  }
}

/** True when the outside interaction started inside the anchor panel. */
function isInsideAnchor(anchor: HTMLElement | null, target: EventTarget | null): boolean {
  return !isNil(anchor) && target instanceof Node && anchor.contains(target)
}

/** Panel docked beside an anchor at wide widths, a centered modal below 900 px. */
export function DockedPanel(props: DockedPanelProps) {
  const { open: isOpen, anchorRef, fallback = 'modal', label, className, children } = props
  const isWide = useMediaQuery(WIDE_QUERY)
  const [size, setSize] = useState<PanelSize | null>(null)

  useEffect(() => {
    if (!isOpen || !isWide) {
      return
    }

    const update = () => {
      const anchor = anchorRef.current

      if (isNil(anchor)) {
        return
      }

      setSize(measureAnchor(anchor))
    }

    update()
    window.addEventListener('resize', update)

    return () => {
      window.removeEventListener('resize', update)
    }
  }, [anchorRef, isOpen, isWide])

  const handleInteractOutside = (event: Event) => {
    if (isInsideAnchor(anchorRef.current, event.target)) {
      event.preventDefault()
    }
  }

  if (!isWide && fallback === 'modal') {
    return (
      <Modal
        open={isOpen}
        onOpenChange={props.onOpenChange}
        label={label}
        className={cn(MODAL_CLASSES, className)}
      >
        {children}
      </Modal>
    )
  }

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={props.onOpenChange} modal={false}>
      <PopoverPrimitive.Anchor virtualRef={anchorRef} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className={cn(PANEL_CLASSES, className)}
          style={size ?? undefined}
          onInteractOutside={handleInteractOutside}
        >
          <PopoverPrimitive.Title className="sr-only">{label}</PopoverPrimitive.Title>
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
