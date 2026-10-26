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

function isTargetInScope(scope: HTMLElement | null, target: EventTarget | null): boolean {
  if (target === document.body) {
    return true
  }

  if (isNil(scope) || !(target instanceof Node)) {
    return false
  }

  return scope.contains(target)
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

      if (!isTargetInScope(scopeRef.current, event.target)) {
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
