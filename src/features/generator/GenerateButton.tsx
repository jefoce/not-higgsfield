'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Spinner } from '@/ui/Spinner'
import { Tooltip } from '@/ui/Tooltip'

interface GenerateButtonProps {
  onGenerate: () => void
  isGenerating: boolean
  disabled: boolean
  error?: string
  price: number | null
}

/** Primary generate action with price, validation tooltip and in-flight spinner. */
export function GenerateButton(props: GenerateButtonProps) {
  const {
    onGenerate,
    isGenerating,
    disabled,
    error,
    price,
  } = props
  return (
    <Tooltip content={disabled ? error : null}>
      <span className="block w-full">
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled || isGenerating}
          aria-busy={isGenerating || undefined}
          className={cn(
            'flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 pb-0.5 text-base font-semibold transition-transform duration-200',
            'disabled:pointer-events-none',
            disabled
              ? 'bg-disabled-surface text-disabled'
              : 'bg-[radial-gradient(circle,var(--color-lime-hi)_40%,var(--color-lime))] text-on-lime shadow-[inset_0_-3px_rgba(0,0,0,0.43)] hover:opacity-80 active:scale-[0.97] active:opacity-60',
          )}
        >
          Generate
          {isGenerating ? <Spinner size={16} /> : <Sparkles size={20} />}
          {price !== null && <span className="tabular-nums">{price.toFixed(2)}</span>}
        </button>
      </span>
    </Tooltip>
  )
}
