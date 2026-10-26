'use client'

import { type RefObject, useEffect } from 'react'
import { isNil } from 'lodash-es'

interface UseChainKeysParams {
  isEnabled: boolean
  onPrevious: () => void
  onNext: () => void
  scopeRef: RefObject<HTMLElement | null>
}

const IGNORED_TARGETS = 'input, textarea, select, [contenteditable], [role="slider"]'

const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]'

/** True when the scope sits in the last dialog of the document. */
function isTopmostDialog(scope: HTMLElement | null): boolean {
  const dialog = scope?.closest(DIALOG_SELECTOR)

  if (isNil(dialog)) {
    return false
  }

  const dialogs = document.querySelectorAll(DIALOG_SELECTOR)

  return dialogs[dialogs.length - 1] === dialog
}

function isIgnoredTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !isNil(target.closest(IGNORED_TARGETS))
}

/** Arrow key navigation for a modal item chain. */
export function useChainKeys(params: UseChainKeysParams): void {
  const { isEnabled, onPrevious, onNext, scopeRef } = params

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.shiftKey ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey
      ) {
        return
      }

      if (!isTopmostDialog(scopeRef.current)) {
        return
      }

      if (isIgnoredTarget(event.target)) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onPrevious()

        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isEnabled, onNext, onPrevious, scopeRef])
}
