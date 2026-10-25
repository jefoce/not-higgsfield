'use client'

import { useCallback, useMemo, useState } from 'react'

export interface BooleanState {
  value: boolean
  set: (next: boolean) => void
  on: () => void
  off: () => void
  toggle: () => void
}

/** Boolean state with stable on, off, toggle and set callbacks. */
export function useBoolean(isInitiallyOn = false): BooleanState {
  const [isOn, setIsOn] = useState(isInitiallyOn)

  const on = useCallback(() => {
    return setIsOn(true)
  }, [])

  const off = useCallback(() => {
    return setIsOn(false)
  }, [])

  const toggle = useCallback(() => {
    return setIsOn((isCurrent) => {
      return !isCurrent
    })
  }, [])

  return useMemo(() => {
    return { value: isOn, set: setIsOn, on, off, toggle }
  }, [isOn, off, on, toggle])
}
