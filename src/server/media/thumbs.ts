import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { clamp } from 'lodash-es'
import sharp from 'sharp'
import { PREVIEW_AT_SEC, THUMB_WIDTH } from '@/core/constants'
import type { MediaKind } from '@/core/types'
import { THUMBS_DIR } from '../paths'
import { HttpError } from '../request-guard'
import { extractFrame } from './ffmpeg'

class ThumbUnavailableError extends HttpError {
  constructor() {
    super(404, 'Thumbnail unavailable')
  }
}

export interface ThumbInput {
  ref: string
  absolutePath: string
  kind: MediaKind
  mtimeMs: number
  width: number
}

export interface ThumbResult {
  filePath: string
  contentType: 'image/webp'
}

const MAX_CONCURRENT = 4
const inFlight = new Map<string, Promise<ThumbResult>>()
const waiters: Array<() => void> = []
let active = 0

export async function getThumbnail(input: ThumbInput): Promise<ThumbResult> {
  if (input.kind === 'audio') throw new ThumbUnavailableError()

  const width = clamp(Math.round(input.width) || THUMB_WIDTH, 32, 1280)
  const hash = createHash('sha1')
    .update(`${input.ref}:${input.mtimeMs}:${width}`)
    .digest('hex')
  const filePath = path.join(THUMBS_DIR, `${hash}.webp`)

  await fs.mkdir(THUMBS_DIR, { recursive: true })
  if (await exists(filePath)) return { filePath, contentType: 'image/webp' }

  const shared = inFlight.get(hash)
  if (shared) return shared

  const task = createThumb({ input, hash, width, filePath }).finally(() =>
    inFlight.delete(hash),
  )
  inFlight.set(hash, task)
  return task
}

interface CreateThumbParams {
  input: ThumbInput
  hash: string
  width: number
  filePath: string
}

async function createThumb(params: CreateThumbParams): Promise<ThumbResult> {
  const { input, hash, width, filePath } = params
  try {
    const buffer = await withSlot(() =>
      input.kind === 'image'
        ? renderImage(input.absolutePath, width)
        : renderVideo({ absPath: input.absolutePath, hash, width }),
    )
    await writeAtomic(filePath, buffer)
    return { filePath, contentType: 'image/webp' }
  } catch {
    throw new ThumbUnavailableError()
  }
}

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiters.push(resolve))
  active += 1
  try {
    return await fn()
  } finally {
    active -= 1
    waiters.shift()?.()
  }
}

async function renderImage(absPath: string, width: number): Promise<Buffer> {
  return sharp(absPath).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
}

interface RenderVideoParams {
  absPath: string
  hash: string
  width: number
}

async function renderVideo(params: RenderVideoParams): Promise<Buffer> {
  const { absPath, hash, width } = params
  const frame = path.join(THUMBS_DIR, `${hash}.${randomUUID()}.tmp.png`)
  try {
    await extractFrame({ videoPath: absPath, atSec: PREVIEW_AT_SEC, width, outPath: frame })
    return await sharp(frame).webp({ quality: 78 }).toBuffer()
  } finally {
    await fs.unlink(frame).catch(() => undefined)
  }
}

async function writeAtomic(filePath: string, data: Buffer): Promise<void> {
  const temp = `${filePath}.tmp-${randomUUID()}`
  try {
    await fs.writeFile(temp, data)
    await fs.rename(temp, filePath)
  } catch (error) {
    await fs.unlink(temp).catch(() => undefined)
    throw error
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
