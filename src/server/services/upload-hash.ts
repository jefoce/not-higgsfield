import 'server-only'

import fs from 'node:fs/promises'

import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { UploadItem } from '@/core/schemas/upload-item'

import { globalState } from '../global-state'
import { uploadPaths, UPLOADS_DIR } from '../paths'
import { listUploadRecords, loadUploadRecord, updateUpload } from '../repos/upload-record'
import { uploadExists } from '../repos/uploads'
import { hashFile } from '../storage/hash'
import { createLimiter } from '../sync/limiter'
import { withLock } from '../sync/lock'

interface HashIndex {
  map: Map<string, string>
  ready: Promise<void> | null
}

interface PathHashEntry {
  size: number
  mtimeMs: number
  sha256: string
}

const backfillLimiter = createLimiter('uploadHashBackfill', 2)

const pathHashes = globalState<Map<string, PathHashEntry>>('uploadPathHashes', () => {
  return new Map()
})

function getIndex(): HashIndex {
  return globalState<HashIndex>(`uploadHashes:${UPLOADS_DIR}`, () => {
    return { map: new Map(), ready: null }
  })
}

/** Hashes every record without a digest once, at most two files at a time. */
async function buildIndex(): Promise<void> {
  const index = getIndex()
  const records = await listUploadRecords()

  await Promise.all(
    records.map((record) => {
      return indexRecord(index, record)
    }),
  )
}

async function indexRecord(index: HashIndex, record: UploadItem): Promise<void> {
  if (isNonEmptyString(record.sha256)) {
    if (await uploadExists(record)) {
      index.map.set(record.sha256, record.id)
    }

    return
  }

  await backfillLimiter.run(async () => {
    if (!(await uploadExists(record))) {
      return
    }

    const sha256 = await hashPathCached(uploadPaths(record.id, record.ext).media)

    const saved = await updateUpload(record.id, (current) => {
      return { ...current, sha256 }
    })

    if (saved) {
      index.map.set(sha256, saved.id)
    }
  })
}

async function ensureIndex(): Promise<HashIndex> {
  const index = getIndex()

  index.ready ??= buildIndex().catch((error: unknown) => {
    index.ready = null

    throw error
  })

  await index.ready

  return index
}

/** Returns the live upload with this digest, or null when it vanished. */
export async function findUploadByHash(sha256: string): Promise<UploadItem | null> {
  const index = await ensureIndex()
  const id = index.map.get(sha256)

  if (isNil(id)) {
    return null
  }

  const record = await loadUploadRecord(id)

  if (isNil(record) || !(await uploadExists(record))) {
    index.map.delete(sha256)

    return null
  }

  return { ...record, missing: false }
}

export function rememberUploadHash(sha256: string, id: string): void {
  getIndex().map.set(sha256, id)
}

export function forgetUploadHash(sha256: string): void {
  getIndex().map.delete(sha256)
}

/** Reuses the digest while the file's size and mtime stay the same. */
export async function hashPathCached(file: string): Promise<string> {
  const stats = await fs.stat(file)
  const cached = pathHashes.get(file)

  if (cached?.size === stats.size && cached.mtimeMs === stats.mtimeMs) {
    return cached.sha256
  }

  const digest = await hashFile(file)

  pathHashes.set(file, {
    size: digest.size,
    mtimeMs: digest.mtimeMs,
    sha256: digest.sha256Hex,
  })

  return digest.sha256Hex
}

/** Serializes work per digest so two uploads of the same bytes cannot race. */
export function runWithHashLock<T>(sha256: string, task: () => Promise<T>): Promise<T> {
  return withLock(`uploadHash:${sha256}`, task)
}
