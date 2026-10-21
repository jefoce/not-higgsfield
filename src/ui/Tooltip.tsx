'use client'

import type { ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { cn } from '@/lib/cn'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
  className?: string
}

/** Single tooltip with its own provider. Falsy content renders children only. */
export function Tooltip(props: TooltipProps) {
  const { content, children, side = 'top', disabled, className } = props
  if (!content || disabled) return <>{children}</>

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className={cn(
              'z-50 max-w-[280px] rounded-lg bg-page-2/90 px-2 py-1 text-xs font-medium leading-4 text-fg shadow-lg ring-1 ring-white/5 backdrop-blur-md',
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
