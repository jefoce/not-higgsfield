'use client'

import { useEffect } from 'react'

interface UseChainKeysParams {
  isEnabled: boolean
  onPrevious: () => void
  onNext: () => void
}

const IGNORED_TARGETS = 'input, textarea, select, [contenteditable], [role="slider"]'

/** Arrow key navigation for a modal item chain. */
export function useChainKeys(params: UseChainKeysParams): void {
  const { isEnabled, onPrevious, onNext } = params

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

      if (event.target instanceof Element && event.target.closest(IGNORED_TARGETS)) {
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
  }, [isEnabled, onPrevious, onNext])
}
