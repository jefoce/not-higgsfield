// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MediaBox } from '@/ui/MediaBox'

import { required } from './helpers/required'

afterEach(() => {
  cleanup()
})

function box(aspect: string): HTMLElement {
  const { container } = render(
    <MediaBox aspect={aspect}>
      <div />
    </MediaBox>,
  )

  return required(container.firstElementChild, 'media box') as HTMLElement
}

describe('MediaBox', () => {
  it('fills the width for a wide aspect and keeps the ratio', () => {
    const element = box('16:9')

    expect(element.className).toContain('w-full')
    expect(element.style.aspectRatio).toBe('16/9')
  })

  it('fills the height for a tall aspect', () => {
    const element = box('9/16')

    expect(element.classList.contains('h-full')).toBe(true)
    expect(element.classList.contains('w-full')).toBe(false)
  })

  it('clips the media inside a rounded, bounded box', () => {
    const element = box('1920/1080')

    expect(element.className).toContain('rounded-xl')
    expect(element.className).toContain('overflow-hidden')
    expect(element.className).toContain('max-h-full')
    expect(element.className).toContain('max-w-full')
  })
})
