'use client'

import { type ReactNode, type RefObject } from 'react'
import { isNil } from 'lodash-es'

import type { StorageProviderDescriptor, VideoProviderDescriptor } from '@/core/providers/types'
import type { SecretName } from '@/core/secret-names'
import type { SecretKeyStatus } from '@/core/types'
import { platform } from '@/lib/platform'
import { Button } from '@/ui/Button'

import { SecretFields } from './SecretFields'
import type { SettingsSection } from './settings-store'
import { TestMessageLine } from './TestMessageLine'
import type { TestMessage } from './use-secrets'
import type { SecretChange } from './use-settings-draft'

const LINK_CLASSES = 'text-xxs text-fg-2 hover:text-fg hover:underline'

interface SecretSectionProps {
  sectionRef: RefObject<HTMLElement | null>
  descriptor: VideoProviderDescriptor | StorageProviderDescriptor
  description?: ReactNode
  keys: Record<SecretName, SecretKeyStatus>
  values: Partial<Record<SecretName, string | null>>
  onChange: (name: SecretName, change: SecretChange) => void
  ready: boolean
  testing: boolean
  result: TestMessage | null
  warning?: ReactNode
  onTest: (target: SettingsSection) => void
}

/** One provider block: heading, links, key fields, Test button and result line. */
export function SecretSection(props: SecretSectionProps) {
  const {
    sectionRef,
    descriptor,
    description,
    keys,
    values,
    ready: isReady,
    testing: isTesting,
    result,
    warning,
  } = props

  const creditsUrl = descriptor.links.credits

  const handleTest = () => {
    props.onTest(descriptor.id)
  }

  const keysUrl = descriptor.links.keys

  const handleOpenKeys = () => {
    void platform.openExternal(keysUrl).catch(() => {})
  }

  const handleOpenCredits = () => {
    if (isNil(creditsUrl)) {
      return
    }

    void platform.openExternal(creditsUrl).catch(() => {})
  }

  const title = isReady ? undefined : 'Save a key first'

  return (
    <section ref={sectionRef} className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-fg-2 uppercase">
          {descriptor.label}
        </h3>
        <div className="flex items-baseline gap-3">
          {description}
          <button type="button" className={LINK_CLASSES} onClick={handleOpenKeys}>
            Keys
          </button>
          {!isNil(creditsUrl) && (
            <button type="button" className={LINK_CLASSES} onClick={handleOpenCredits}>
              Credits
            </button>
          )}
        </div>
      </div>
      <SecretFields
        fields={descriptor.fields}
        keys={keys}
        values={values}
        onChange={props.onChange}
      />
      {warning}
      <div className="flex items-center gap-3">
        <span title={title}>
          <Button
            size="sm"
            variant="outline"
            disabled={!isReady}
            loading={isTesting}
            onClick={handleTest}
          >
            Test
          </Button>
        </span>
        <TestMessageLine result={result} />
      </div>
    </section>
  )
}
