'use client'

import { useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { slotLabel, type RefSlot } from '@/core/prompt-tokens'
import { issueText, type ValidationIssue } from '@/core/validation'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

interface PromptWarningsProps {
  warnings: ValidationIssue[]
  onFocus?: (slot: RefSlot, occurrence: number) => void
}

/** Warning counter chip with a clickable list. Hidden when there are none. */
export function PromptWarnings(props: PromptWarningsProps) {
  const { warnings, onFocus } = props
  const [open, setOpen] = useState(false)
  const occurrences = useRef<Record<string, number>>({})
  if (!warnings.length) return null

  const go = (slot: RefSlot) => {
    const key = `${slot.kind}-${slot.n}`
    const occurrence = occurrences.current[key] ?? 0
    occurrences.current[key] = occurrence + 1
    onFocus?.(slot, occurrence)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${warnings.length} prompt warnings`}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg bg-warn px-2 text-xs font-medium text-white hover:brightness-110"
        >
          <TriangleAlert size={14} />
          {warnings.length}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-0.5 p-1">
        {warnings.map((issue, index) => {
          if (issue.type === 'text') {
            return (
              <p key={`text-${index}`} className="px-2 py-1.5 text-xs text-fg">
                {issue.text}
              </p>
            )
          }
          const chip = `@${slotLabel(issue.slot)}`
          return (
            <button
              key={`${issue.slot.kind}-${issue.slot.n}`}
              type="button"
              onClick={() => go(issue.slot)}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-fg hover:bg-white/5"
            >
              <span className="inline-flex shrink-0 items-center rounded bg-danger/10 px-1 font-medium text-danger">
                {chip}
              </span>
              <span className="text-fg-2">{issueText(issue).replace(`${chip} `, '')}</span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
