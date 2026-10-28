import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { removeOwnedFile as RemoveOwnedFile } from '@/server/fs/json-file'
import type * as Folders from '@/server/repos/folders'
import type * as Uploads from '@/server/services/uploads'

vi.mock('server-only', () => {
  return {}
})

const ROOT = path.join(process.cwd(), '.cache', `delete-safety-test-${process.pid}`)
const UPLOADS = path.join(ROOT, 'uploads')
const OUTSIDE = path.join(process.cwd(), '.cache', `delete-safety-outside-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

let removeOwnedFile: typeof RemoveOwnedFile
let folders: typeof Folders
let uploads: typeof Uploads

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.rm(OUTSIDE, { recursive: true, force: true })

  await fs.mkdir(OUTSIDE, { recursive: true })

  ;({ removeOwnedFile } = await import('@/server/fs/json-file'))
  folders = await import('@/server/repos/folders')
  uploads = await import('@/server/services/uploads')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(UPLOADS, { recursive: true })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.rm(OUTSIDE, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

async function exists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
}

describe('removeOwnedFile', () => {
  it('deletes a uuid basename inside the storage root', async () => {
    const file = path.join(ROOT, `${randomUUID()}.png`)

    await fs.writeFile(file, 'x')
    await removeOwnedFile(file)

    expect(await exists(file)).toBe(false)
  })

  it('deletes a hash basename inside the storage root', async () => {
    const file = path.join(ROOT, `${'a'.repeat(40)}.webp`)

    await fs.writeFile(file, 'x')
    await removeOwnedFile(file)

    expect(await exists(file)).toBe(false)
  })

  it('refuses a path outside the storage root', async () => {
    const file = path.join(OUTSIDE, `${randomUUID()}.png`)

    await fs.writeFile(file, 'x')

    await expect(removeOwnedFile(file)).rejects.toThrow('Refusing to delete outside storage')
    expect(await exists(file)).toBe(true)
  })

  it('refuses a basename the app does not own', async () => {
    const file = path.join(ROOT, 'notes.txt')

    await fs.writeFile(file, 'x')

    await expect(removeOwnedFile(file)).rejects.toThrow(
      'Refusing to delete a file the app does not own',
    )

    expect(await exists(file)).toBe(true)
  })

  it('treats a missing owned file as success', async () => {
    await expect(removeOwnedFile(path.join(ROOT, `${randomUUID()}.png`))).resolves.toBeUndefined()
  })
})

describe('upload delete safety', () => {
  it('leaves a link target outside the storage root untouched', async () => {
    const target = path.join(OUTSIDE, 'source.png')

    await fs.writeFile(target, 'not really a png')

    const item = await uploads.createLinkUpload({ absPath: target })

    await uploads.removeUpload(item.id)

    expect(await exists(target)).toBe(true)
  })
})

describe('folder disconnect safety', () => {
  it('leaves every file in the folder untouched', async () => {
    const folderDir = path.join(OUTSIDE, 'folder')

    await fs.mkdir(folderDir, { recursive: true })
    await fs.writeFile(path.join(folderDir, 'a.png'), 'a')
    await fs.writeFile(path.join(folderDir, 'b.png'), 'b')

    const folder = await folders.addFolder({ path: folderDir })

    await folders.removeFolder(folder.id)

    expect((await fs.readdir(folderDir)).sort()).toEqual(['a.png', 'b.png'])
  })
})
