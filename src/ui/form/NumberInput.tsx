'use client'

import { forwardRef, useEffect, useState } from 'react'
import { clamp, round } from 'lodash-es'
import { Input, type InputProps } from './Input'

interface NumberInputProps
  extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  value: number | null
  onValueChange: (value: number | null) => void
  min?: number
  max?: number
}

const format = (value: number | null): string => (value === null ? '' : String(value))

const parse = (text: string): number | null => {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/** Number input that reports null when empty and rounds/clamps on blur. */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  props,
  ref,
) {
  const { value, onValueChange, min, max, onBlur, ...rest } = props
  const [draft, setDraft] = useState(format(value))

  useEffect(() => {
    if (parse(draft) !== value) setDraft(format(value))
  }, [value, draft])

  const commit = () => {
    const parsed = parse(draft)
    if (parsed === null) {
      onValueChange(null)
      setDraft('')
      return
    }
    const next = clamp(round(parsed), min ?? -Infinity, max ?? Infinity)
    onValueChange(next)
    setDraft(String(next))
  }

  return (
    <Input
      ref={ref}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value)
        onValueChange(parse(event.target.value))
      }}
      onBlur={(event) => {
        commit()
        onBlur?.(event)
      }}
      {...rest}
    />
  )
})
