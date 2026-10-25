'use client'

import { useEffect, useState } from 'react'

/** Value that settles after it stops changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      return setDebouncedValue(value)
    }, delayMs)

    return () => {
      return clearTimeout(timer)
    }
  }, [delayMs, value])

  return debouncedValue
}
