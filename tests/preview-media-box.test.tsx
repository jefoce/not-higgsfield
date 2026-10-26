// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PreviewBody } from '@/features/preview/PreviewBody'

import { upload } from './helpers/validation-fixtures'

afterEach(cleanup)

/** MediaBox root, the only element carrying an aspect-ratio style. */
function boxOf(container: HTMLElement): HTMLElement {
  const box = container.querySelector<HTMLElement>('[style*="aspect-ratio"]')

  if (!box) {
    throw new Error('MediaBox not rendered')
  }

  return box
}

/** jsdom leaves natural sizes at zero, so tests define them before the load event. */
function defineNaturalSize(image: HTMLImageElement, width: number, height: number): void {
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height })
}

describe('preview image box', () => {
  it('uses the upload size and the shared rounded box', () => {
    const item = upload('photo', 'image', { width: 1200, height: 800 })
    const { container } = render(<PreviewBody item={item} playerId="preview:photo" />)
    const box = boxOf(container)

    expect(box.style.aspectRatio).toBe('1200/800')
    expect(box.classList.contains('rounded-xl')).toBe(true)
    expect(box.classList.contains('overflow-hidden')).toBe(true)
  })

  it('falls back to the natural size once the image loads', () => {
    const item = upload('staged', 'image')
    const { container } = render(<PreviewBody item={item} playerId="preview:staged" />)
    const image = container.querySelector('img')

    if (!image) {
      throw new Error('Image not rendered')
    }

    expect(boxOf(container).style.aspectRatio).toBe('16/9')

    defineNaturalSize(image, 640, 480)
    fireEvent.load(image)

    expect(boxOf(container).style.aspectRatio).toBe('640/480')
  })
})
