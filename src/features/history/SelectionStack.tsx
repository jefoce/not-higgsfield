import { AlertCircle, Video } from 'lucide-react'
import { ACTIVE_STATUSES, type GenerationRecord } from '@/core/types'
import { Spinner } from '@/ui/Spinner'
import { posterSrc } from './record-view'

interface SelectionStackProps {
  stack: string[]
  byId: Map<string, GenerationRecord>
}

interface StackIconProps {
  record: GenerationRecord
}

function StackIcon(props: StackIconProps) {
  const { record } = props
  if (ACTIVE_STATUSES.includes(record.status)) return <Spinner size={12} tone="muted" />
  if (record.status !== 'completed') return <AlertCircle size={12} aria-hidden />
  return <Video size={12} aria-hidden />
}

/** Up to three poster thumbs for the selected records, newest first. */
export function SelectionStack(props: SelectionStackProps) {
  const { stack, byId } = props
  return (
    <div data-testid="selection-stack" className="relative ml-1 mr-3 size-8 shrink-0" aria-hidden>
      {stack.map((id, index) => {
        const record = byId.get(id)
        if (!record) return null
        const poster = posterSrc(record, 80)
        return (
          <span
            key={id}
            className="absolute inset-0 overflow-hidden rounded-md bg-surface ring-2 ring-surface-2"
            style={{
              transform: `translateX(-${index * 5}px) rotate(-${index * 6}deg)`,
              zIndex: 3 - index,
            }}
          >
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element -- 32px poster thumb
              <img src={poster} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-fg-2">
                <StackIcon record={record} />
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
