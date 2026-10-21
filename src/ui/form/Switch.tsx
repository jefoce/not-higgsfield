'use client'

import { Switch as SwitchPrimitive } from 'radix-ui'
import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: React.ReactNode
  id?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/** Radix switch with an optional inline label. */
export function Switch(props: SwitchProps) {
  const {
    checked,
    onCheckedChange,
    label,
    id,
    disabled,
    className,
    'aria-label': ariaLabel,
  } = props
  return (
    <label className={cn('flex items-center gap-2 text-xs text-fg-2', className)}>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className="relative h-4 w-7 shrink-0 rounded-full bg-white/15 transition data-[state=checked]:bg-lime disabled:opacity-40"
      >
        <SwitchPrimitive.Thumb className="block h-3 w-3 translate-x-0.5 rounded-full bg-white transition data-[state=checked]:translate-x-3.5" />
      </SwitchPrimitive.Root>
      {Boolean(label) && <span>{label}</span>}
    </label>
  )
}
