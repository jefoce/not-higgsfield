import 'server-only'

import { FLATTEN_BACKGROUND, FLATTEN_LIGHT, FLATTEN_LUMINANCE } from '@/core/constants'

import type { FlattenColor } from './image-cache'
import sharp from './sharp'

/** Average of opaque pixels that touch transparency, at 256 px preview. */
export async function flattenColor(source: string): Promise<FlattenColor> {
  const { data, info } = await sharp(source, { pages: 1 })
    .rotate()
    .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const channels = info.channels
  let red = 0
  let green = 0
  let blue = 0
  let count = 0

  const alphaAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return 0
    }

    return data[(y * width + x) * channels + 3]
  }

  const touchesTransparency = (x: number, y: number): boolean =>
    alphaAt(x - 1, y) < 255 ||
    alphaAt(x + 1, y) < 255 ||
    alphaAt(x, y - 1) < 255 ||
    alphaAt(x, y + 1) < 255

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels

      if (data[index + 3] !== 255) {
        continue
      }

      if (!touchesTransparency(x, y)) {
        continue
      }

      red += data[index]
      green += data[index + 1]
      blue += data[index + 2]
      count += 1
    }
  }

  if (count === 0) {
    return FLATTEN_BACKGROUND
  }

  const luminance =
    (0.2126 * (red / count) + 0.7152 * (green / count) + 0.0722 * (blue / count)) / 255

  return luminance > FLATTEN_LUMINANCE ? FLATTEN_LIGHT : FLATTEN_BACKGROUND
}
