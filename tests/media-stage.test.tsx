// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MediaStage } from '@/ui/MediaStage'
import { STAGE_GRADIENTS, stageGradient } from '@/ui/stage-gradients'

function gradientClass(container: HTMLElement): string {
  const node = container.querySelector('[class*="bg-linear-to-br"]')

  return node?.className ?? ''
}

afterEach(() => {
  cleanup()
})

describe('MediaStage', () => {
  it('renders a blurred image backdrop', () => {
    const { container } = render(
      <MediaStage backdrop={{ kind: 'image', src: '/thumb.jpg' }}>
        <span />
      </MediaStage>,
    )

    const image = container.querySelector('img')

    expect(image?.getAttribute('alt')).toBe('')
    expect(image?.getAttribute('aria-hidden')).toBe('true')
    expect(image?.className).toContain('blur-3xl')
    expect(image?.className).toContain('object-cover')
  })

  it('renders the same gradient for the same seed', () => {
    const seed = 'item-42'
    const expected = stageGradient(seed)

    const first = render(
      <MediaStage backdrop={{ kind: 'gradient', seed }}>
        <span />
      </MediaStage>,
    )

    expect(gradientClass(first.container)).toContain(expected)

    cleanup()

    const second = render(
      <MediaStage backdrop={{ kind: 'gradient', seed }}>
        <span />
      </MediaStage>,
    )

    expect(gradientClass(second.container)).toContain(expected)
  })

  it('spreads seeds across the palette', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

    const classes = new Set(
      seeds.map((seed) => {
        return stageGradient(seed)
      }),
    )

    expect(classes.size).toBeGreaterThan(1)

    for (const className of classes) {
      expect(STAGE_GRADIENTS).toContain(className)
    }
  })
})
