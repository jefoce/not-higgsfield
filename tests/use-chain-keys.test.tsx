// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useChainKeys } from '@/lib/use-chain-keys'

interface PressParams {
  key: string
  isShiftKey?: boolean
  isPrevented?: boolean
  target?: EventTarget
}

function press(params: PressParams): KeyboardEvent {
  const { key, isShiftKey = false, isPrevented = false, target = window } = params

  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey: isShiftKey,
    bubbles: true,
    cancelable: true,
  })

  if (isPrevented) {
    event.preventDefault()
  }

  act(() => {
    target.dispatchEvent(event)
  })

  return event
}

function renderKeys(isEnabled = true) {
  const onPrevious = vi.fn()
  const onNext = vi.fn()

  renderHook(() => {
    useChainKeys({ isEnabled, onPrevious, onNext })
  })

  return { onPrevious, onNext }
}

function expectIgnored(target: EventTarget): void {
  const { onPrevious, onNext } = renderKeys()
  const event = press({ key: 'ArrowLeft', target })

  expect(onPrevious).not.toHaveBeenCalled()
  expect(onNext).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)

  cleanup()
}

afterEach(() => {
  cleanup()
})

describe('useChainKeys', () => {
  it('moves to the previous and next item on arrows', () => {
    const { onPrevious, onNext } = renderKeys()
    const left = press({ key: 'ArrowLeft' })
    const right = press({ key: 'ArrowRight' })

    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(left.defaultPrevented).toBe(true)
    expect(right.defaultPrevented).toBe(true)
  })

  it('does nothing while disabled', () => {
    const { onPrevious, onNext } = renderKeys(false)
    const event = press({ key: 'ArrowLeft' })

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores a modified arrow', () => {
    const { onPrevious, onNext } = renderKeys()
    const event = press({ key: 'ArrowLeft', isShiftKey: true })

    expect(onPrevious).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores an already prevented event', () => {
    const { onPrevious } = renderKeys()
    const event = press({ key: 'ArrowLeft', isPrevented: true })

    expect(onPrevious).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores input, textarea and slider targets', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const slider = document.createElement('div')

    slider.setAttribute('role', 'slider')
    document.body.append(input, textarea, slider)

    expectIgnored(input)
    expectIgnored(textarea)
    expectIgnored(slider)

    input.remove()
    textarea.remove()
    slider.remove()
  })
})
