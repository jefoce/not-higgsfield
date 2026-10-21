'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Input, type InputProps } from './Input'

/** Password input with a reveal toggle, disabled while empty or disabled. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  props,
  ref,
) {
  const { className, disabled, value, ...rest } = props
  const [revealed, setRevealed] = useState(false)
  const empty = value === undefined || value === null || value === ''

  return (
    <div className="relative flex-1">
      <Input
        ref={ref}
        type={revealed && !empty ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        {...rest}
        className={cn('pr-9', className)}
      />
      {!disabled && (
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          disabled={empty}
          aria-label={revealed ? 'Hide value' : 'Show value'}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-fg-2 hover:text-fg disabled:opacity-30"
        >
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      )}
    </div>
  )
})
