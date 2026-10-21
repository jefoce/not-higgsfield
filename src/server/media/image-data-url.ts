import 'server-only'
import { sumBy } from 'lodash-es'
import sharp from 'sharp'
import {
  FLATTEN_BACKGROUND,
  FLATTEN_LIGHT,
  FLATTEN_LUMINANCE,
  IMAGE_MAX_ENCODED_MB,
  IMAGE_MAX_SIDE_PX,
  IMAGE_STEPS,
} from '@/core/constants'
import type { ModelPreset } from '@/core/presets'
import type { ReferencePlan, UploadItem } from '@/core/types'
import { uploadPaths } from '../paths'
import { HttpError } from '../request-guard'
import {
  type CacheRecord,
  type EncodedImage,
  type FlattenColor,
  readCache,
  toEncoded,
  writeCache,
} from './image-cache'

export interface EncodeImagesParams {
  uploads: UploadItem[]
  preset: ModelPreset
  budgetBytes: number
  baseBytes?: number
}

export interface EncodedImages {
  plan: ReferencePlan
  media: Record<string, EncodedImage>
}

/** Plain failure when even the last ladder step does not fit. */
export class ImageTooLargeError extends HttpError {
  constructor() {
    super(400, 'References are too large to send. Remove some images or use smaller ones.')
  }
}

const MB = 1024 * 1024
const FALLBACK_BACKGROUND: FlattenColor = FLATTEN_BACKGROUND

interface EncodeStepParams {
  upload: UploadItem
  step: number
  maxSide: number
  jpegQuality: number
  alpha: boolean
}

/** Encodes every image at one shared ladder step, then checks the request budget. */
export async function encodeImages(params: EncodeImagesParams): Promise<EncodedImages> {
  const { uploads, preset, budgetBytes, baseBytes = 0 } = params
  const images = uploads.filter((upload) => upload.kind === 'image')
  const limit = preset.referenceLimits?.image
  const perImageBytes = Math.min(limit?.maxBytes ?? Infinity, IMAGE_MAX_ENCODED_MB * MB)

  if (!images.length) {
    return {
      plan: {
        step: 1,
        maxSide: sideFor(IMAGE_STEPS[0].maxSidePx, limit?.maxSidePx),
        totalBytes: 0,
        images: [],
      },
      media: {},
    }
  }

  for (const [index, step] of IMAGE_STEPS.entries()) {
    const maxSide = sideFor(step.maxSidePx, limit?.maxSidePx)
    const encoded = await Promise.all(
      images.map(async (upload) => ({
        upload,
        image: await encodeAtStep({
          upload,
          step: index + 1,
          maxSide,
          jpegQuality: step.jpegQuality,
          alpha: limit?.alpha ?? false,
        }),
      })),
    )
    const totalBytes = sumBy(encoded, ({ image }) => image.bytes)
    const fits = totalBytes + baseBytes <= budgetBytes
    const underCap = encoded.every(({ image }) => image.bytes <= perImageBytes)
    if (!fits || !underCap) continue

    const media = Object.fromEntries(encoded.map(({ upload, image }) => [upload.id, image]))
    return {
      plan: {
        step: index + 1,
        maxSide,
        totalBytes,
        images: encoded.map(({ upload, image }) => ({
          id: upload.id,
          width: image.width,
          height: image.height,
          bytes: image.bytes,
          format: image.format,
          flattened: image.flattened,
        })),
      },
      media,
    }
  }
  throw new ImageTooLargeError()
}

const sideFor = (stepSide: number, modelSide?: number): number =>
  Math.min(stepSide, modelSide ?? IMAGE_MAX_SIDE_PX)

/** Cached per upload and step. Source EXIF is never copied to the output. */
async function encodeAtStep(params: EncodeStepParams): Promise<EncodedImage> {
  const { upload, step, maxSide, jpegQuality, alpha } = params
  const cached = await readCache(upload.id, step)
  if (cached) return cached

  const source = uploadPaths(upload.id, upload.ext).media
  const opaque = (await sharp(source, { pages: 1 }).stats()).isOpaque
  const transparent = !opaque
  const keepAlpha = transparent && alpha
  const flattened = transparent && !alpha ? await flattenColor(source) : undefined

  let pipeline = sharp(source, { pages: 1 })
    .rotate()
    .toColorspace('srgb')
    .withIccProfile('srgb')
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })

  if (keepAlpha) {
    pipeline = pipeline.png({ compressionLevel: 9, palette: false })
  } else {
    if (flattened) pipeline = pipeline.flatten({ background: flattened })
    pipeline = pipeline.jpeg({ quality: jpegQuality, mozjpeg: true, chromaSubsampling: '4:4:4' })
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
  const format = keepAlpha ? 'png' : 'jpeg'
  const record: CacheRecord = {
    width: info.width,
    height: info.height,
    bytes: base64Bytes(data.length),
    format,
    flattened,
  }
  await writeCache({ id: upload.id, step, record, data })
  return toEncoded(record, data)
}

const base64Bytes = (bytes: number): number => Math.ceil(bytes / 3) * 4

/** Average of opaque pixels that touch transparency, at 256 px preview. */
async function flattenColor(source: string): Promise<FlattenColor> {
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
    if (x < 0 || y < 0 || x >= width || y >= height) return 0
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
      if (data[index + 3] !== 255) continue
      if (!touchesTransparency(x, y)) continue
      red += data[index]
      green += data[index + 1]
      blue += data[index + 2]
      count += 1
    }
  }
  if (!count) return FALLBACK_BACKGROUND
  const luminance = (0.2126 * (red / count) + 0.7152 * (green / count) + 0.0722 * (blue / count)) / 255
  return luminance > FLATTEN_LUMINANCE ? FLATTEN_LIGHT : FALLBACK_BACKGROUND
}
