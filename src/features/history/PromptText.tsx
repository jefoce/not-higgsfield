import { parsePromptParts } from '@/core/prompt-tokens'
import type { GenerationRecord } from '@/core/types'
import { PromptSlot } from './PromptSlot'
import { recordCounts } from './record-view'

interface PromptTextProps {
  prompt: string
  record: GenerationRecord
}

/** Prompt text with live slot chips. */
export function PromptText(props: PromptTextProps) {
  const { prompt, record } = props
  const counts = recordCounts(record)
  return (
    <>
      {parsePromptParts(prompt, counts).map((part, index) =>
        part.type === 'text' ? (
          <span key={index}>{part.text}</span>
        ) : (
          <PromptSlot key={index} slot={part.slot} record={record} />
        ),
      )}
    </>
  )
}
