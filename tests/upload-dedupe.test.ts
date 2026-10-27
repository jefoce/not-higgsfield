import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import type * as UploadRecord from '@/server/repos/upload-record'
import type * as Uploads from '@/server/services/uploads'

import { required } from './helpers/required'

vi.mock('server-only', () => {
  return {}
})

const ROOT = path.join(process.cwd(), '.cache', `upload-dedupe-test-${process.pid}`)
const UPLOADS = path.join(ROOT, 'uploads')
const SOURCE = path.join(ROOT, 'source.png')
const BYTES = 'identical upload bytes'
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

let uploads: typeof Uploads
let saveUploadItem: typeof UploadRecord.saveUploadItem
let getUploadRecord: typeof UploadRecord.getUploadRecord

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  uploads = await import('@/server/services/uploads')

  ;({ saveUploadItem, getUploadRecord } = await import('@/server/repos/upload-record'))
})

beforeEach(async () => {
  await fs.rm(UPLOADS, { recursive: true, force: true })
  await fs.mkdir(UPLOADS, { recursive: true })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function makeItem(overrides: Partial<UploadItem> = {}): UploadItem {
  return {
    id: randomUUID(),
    source: 'file',
    kind: 'image',
    mime: 'image/png',
    ext: '.png',
    originalName: 'fixture.png',
    sizeBytes: Buffer.byteLength(BYTES),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

async function namesInUploads(): Promise<string[]> {
  return fs.readdir(UPLOADS)
}

describe('upload dedupe', () => {
  // First: the hash index builds once per root, so the digest-less record must exist before it.
  it('backfills a record without sha256 and matches it', async () => {
    const item = makeItem()

    await fs.writeFile(path.join(UPLOADS, `${item.id}${item.ext}`), BYTES)
    await saveUploadItem(item)

    const upload = await uploads.createFileUpload({
      bytes: Buffer.from(BYTES),
      originalName: 'fixture.png',
    })

    expect(upload.id).toBe(item.id)

    const stored = required(await getUploadRecord(item.id), 'backfilled record')

    expect(stored.sha256).toBe(sha256Hex(BYTES))
  })

  it('reuses the same id for identical bytes', async () => {
    const bytes = Buffer.from(BYTES)
    const first = await uploads.createFileUpload({ bytes, originalName: 'a.png' })
    const second = await uploads.createFileUpload({ bytes, originalName: 'b.png' })

    expect(second.id).toBe(first.id)

    const names = await namesInUploads()

    expect(
      names.filter((name) => {
        return name.endsWith('.png')
      }),
    ).toHaveLength(1)

    expect(
      names.filter((name) => {
        return name.endsWith('.json')
      }),
    ).toHaveLength(1)
  })

  it('keeps different bytes apart', async () => {
    const first = await uploads.createFileUpload({
      bytes: Buffer.from('first body'),
      originalName: 'a.png',
    })

    const second = await uploads.createFileUpload({
      bytes: Buffer.from('second body'),
      originalName: 'a.png',
    })

    expect(second.id).not.toBe(first.id)
  })

  it('stores one file when two identical uploads race', async () => {
    const bytes = Buffer.from('racing identical bytes')

    const [first, second] = await Promise.all([
      uploads.createFileUpload({ bytes, originalName: 'a.png' }),
      uploads.createFileUpload({ bytes, originalName: 'b.png' }),
    ])

    expect(second.id).toBe(first.id)

    const names = await namesInUploads()

    expect(
      names.filter((name) => {
        return name.endsWith('.png')
      }),
    ).toHaveLength(1)
  })

  it('stores a fresh copy when the media file is gone', async () => {
    const bytes = Buffer.from('vanishing media')
    const first = await uploads.createFileUpload({ bytes, originalName: 'a.png' })

    await fs.rm(path.join(UPLOADS, `${first.id}${first.ext}`))

    const second = await uploads.createFileUpload({ bytes, originalName: 'a.png' })

    expect(second.id).not.toBe(first.id)
  })

  it('returns the link when the same bytes arrive as a file', async () => {
    await fs.writeFile(SOURCE, BYTES)

    const link = await uploads.createLinkUpload({ absPath: SOURCE })

    const upload = await uploads.createFileUpload({
      bytes: Buffer.from(BYTES),
      originalName: 'copy.png',
    })

    expect(upload.id).toBe(link.id)

    const names = await namesInUploads()

    expect(names).toHaveLength(2)
  })
})
