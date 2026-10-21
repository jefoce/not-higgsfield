'use client'

import { ExternalLink, RefreshCw } from 'lucide-react'
import { formatUsd } from '@/core/pricing'
import { openSettings } from '@/features/settings/settings-store'
import { getPlatform } from '@/lib/platform'
import { useCredits } from './use-credits'

interface RowProps {
  label: string
  value: string
  muted?: boolean
}

function Row(props: RowProps) {
  const { label, value, muted } = props
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-fg-2">{label}</span>
      <span className={muted ? 'text-right text-fg-2' : 'text-right text-fg'}>{value}</span>
    </div>
  )
}

/** Account balance, key limits, usage, and refresh/top-up actions. */
export function CreditsPopover() {
  const { credits, refresh, isLoading } = useCredits()
  const money = (value: number | null | undefined) => (value == null ? '--' : formatUsd(value))
  const keyLimit =
    credits?.keyLimitRemaining == null
      ? 'No key limit'
      : `${money(credits.keyLimitRemaining)} / ${money(credits.keyLimit)}`

  return (
    <div className="space-y-3">
      {credits?.balance != null ? (
        <Row label="Balance" value={formatUsd(credits.balance)} />
      ) : (
        <button
          type="button"
          onClick={() => openSettings('openrouter')}
          className="text-left text-xs text-fg-2 hover:text-fg hover:underline"
        >
          Add a management key to see account balance
        </button>
      )}

      <Row
        label="Key limit"
        value={keyLimit}
        muted={credits?.keyLimitRemaining == null}
      />
      <Row label="Spent today" value={money(credits?.usageDaily)} />
      <Row label="Spent this month" value={money(credits?.usageMonthly)} />
      <Row label="Spent in this app" value={money(credits?.localSpent)} />

      <div className="flex items-center justify-between border-t border-line pt-2">
        <button
          type="button"
          onClick={() => refresh(true)}
          disabled={isLoading}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-subtle px-2 text-xs text-fg hover:bg-hover disabled:opacity-40"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
        <button
          type="button"
          onClick={() =>
            void getPlatform()
              .then((platform) => platform.openExternal('https://openrouter.ai/settings/credits'))
              .catch(() => undefined)
          }
          className="inline-flex items-center gap-1 text-xs text-lime hover:underline"
        >
          Top up
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  )
}
