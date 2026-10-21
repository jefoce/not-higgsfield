import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const ROOT = path.join(process.cwd(), '.cache', `link-mode-test-${process.pid}`)
const UPLOADS = path.join(ROOT, 'uploads')
const SOURCE = path.join(ROOT, 'source.png')
const BYTES = 'not really a png'
const PREVIOUS_ROOT = process.env.STORAGE_ROOT
process.env.STORAGE_ROOT = ROOT

let uploads: typeof import('@/server/repos/uploads')

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  uploads = await import('@/server/repos/uploads')
})

beforeEach(async () => {
  await fs.rm(UPLOADS, { recursive: true, force: true })
  await fs.mkdir(UPLOADS, { recursive: true })
  await fs.writeFile(SOURCE, BYTES)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  if (PREVIOUS_ROOT === undefined) delete process.env.STORAGE_ROOT
  else process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function errno(code: string): Error {
  return Object.assign(new Error(code), { code })
}

describe('link upload fallback', () => {
  it('hard links when symlinks are denied', async () => {
    vi.spyOn(fs, 'symlink').mockRejectedValue(errno('EPERM'))

    const item = await uploads.createLinkUpload({ absPath: SOURCE })
    expect(item.linkMode).toBe('hardlink')

    await fs.rm(SOURCE)
    const [listed] = await uploads.listUploads({ ids: [item.id] })
    expect(listed.missing).toBe(false)
  })

  it('copies bytes when symlinks and hard links both fail', async () => {
    vi.spyOn(fs, 'symlink').mockRejectedValue(errno('EPERM'))
    vi.spyOn(fs, 'link').mockRejectedValue(errno('EXDEV'))

    const item = await uploads.createLinkUpload({ absPath: SOURCE })
    expect(item.linkMode).toBe('copy')

    await fs.rm(SOURCE)
    const [listed] = await uploads.listUploads({ ids: [item.id] })
    expect(listed.missing).toBe(false)
    expect(await fs.readFile(path.join(UPLOADS, `${item.id}.png`), 'utf8')).toBe(BYTES)
  })

  it.skipIf(process.platform === 'win32')('marks a broken symlink missing', async () => {
    const item = await uploads.createLinkUpload({ absPath: SOURCE })
    expect(item.linkMode).toBe('symlink')

    await fs.rm(SOURCE)
    const [listed] = await uploads.listUploads({ ids: [item.id] })
    expect(listed.missing).toBe(true)
  })
})
