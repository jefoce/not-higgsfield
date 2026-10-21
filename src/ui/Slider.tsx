'use client'

import { Slider as SliderPrimitive } from 'radix-ui'
import { cn } from '@/lib/cn'

interface SliderProps {
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step?: number
  className?: string
  ariaLabel?: string
  name?: string
}

/** Single-value ranged slider with neutral track. */
export function Slider(props: SliderProps) {
  const {
    value,
    onValueChange,
    min,
    max,
    step = 1,
    className,
    ariaLabel,
    name,
  } = props
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={([next]) => onValueChange(next)}
      min={min}
      max={max}
      step={step}
      name={name}
      className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow cursor-pointer overflow-hidden rounded-full bg-white/5">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-white/10" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        className="block h-3 w-3 cursor-grab rounded-full bg-white outline-none transition active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  )
}
