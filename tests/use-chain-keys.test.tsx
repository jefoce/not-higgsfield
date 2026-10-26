// @vitest-environment jsdom
import { type RefObject, useRef } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useChainKeys } from '@/lib/use-chain-keys'

interface PressParams {
  key: string
  isShiftKey?: boolean
  isPrevented?: boolean
  target?: EventTarget
}

function press(params: PressParams): KeyboardEvent {
  const { key, isShiftKey = false, isPrevented = false, target = document.body } = params

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
  const scopeRef: RefObject<HTMLElement | null> = { current: null }

  renderHook(() => {
    useChainKeys({ isEnabled, onPrevious, onNext, scopeRef })
  })

  return { onPrevious, onNext }
}

interface TwoChainsProps {
  onFirstPrevious: () => void
  onFirstNext: () => void
  onSecondPrevious: () => void
  onSecondNext: () => void
}

function TwoChains(props: TwoChainsProps) {
  const { onFirstPrevious, onFirstNext, onSecondPrevious, onSecondNext } = props
  const firstRef = useRef<HTMLDivElement>(null)
  const secondRef = useRef<HTMLDivElement>(null)

  useChainKeys({
    isEnabled: true,
    onPrevious: onFirstPrevious,
    onNext: onFirstNext,
    scopeRef: firstRef,
  })

  useChainKeys({
    isEnabled: true,
    onPrevious: onSecondPrevious,
    onNext: onSecondNext,
    scopeRef: secondRef,
  })

  return (
    <div>
      <div ref={firstRef}>
        <button type="button">First</button>
      </div>
      <div ref={secondRef}>
        <button type="button">Second</button>
      </div>
    </div>
  )
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

describe('useChainKeys scopes', () => {
  it('only runs the handler whose scope contains the target', () => {
    const onFirstPrevious = vi.fn()
    const onFirstNext = vi.fn()
    const onSecondPrevious = vi.fn()
    const onSecondNext = vi.fn()

    render(
      <TwoChains
        onFirstPrevious={onFirstPrevious}
        onFirstNext={onFirstNext}
        onSecondPrevious={onSecondPrevious}
        onSecondNext={onSecondNext}
      />,
    )

    const second = screen.getByRole('button', { name: 'Second' })

    second.focus()
    fireEvent.keyDown(second, { key: 'ArrowRight' })

    expect(onSecondNext).toHaveBeenCalledTimes(1)
    expect(onFirstNext).not.toHaveBeenCalled()
    expect(onFirstPrevious).not.toHaveBeenCalled()
    expect(onSecondPrevious).not.toHaveBeenCalled()
  })

  it('does nothing when the target is outside every scope', () => {
    const onFirstNext = vi.fn()
    const onSecondNext = vi.fn()

    render(
      <TwoChains
        onFirstPrevious={vi.fn()}
        onFirstNext={onFirstNext}
        onSecondPrevious={vi.fn()}
        onSecondNext={onSecondNext}
      />,
    )

    const outside = document.createElement('button')

    document.body.append(outside)
    outside.focus()
    fireEvent.keyDown(outside, { key: 'ArrowRight' })

    expect(onFirstNext).not.toHaveBeenCalled()
    expect(onSecondNext).not.toHaveBeenCalled()

    outside.remove()
  })
})
