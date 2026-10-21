import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: number
  className?: string
  tone?: 'lime' | 'muted'
}

/** Small rotating loading indicator. */
export function Spinner(props: SpinnerProps) {
  const { size = 18, className, tone = 'lime' } = props
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-2 border-white/15',
        tone === 'lime' ? 'border-t-lime' : 'border-t-white/50',
        className,
      )}
    />
  )
}
