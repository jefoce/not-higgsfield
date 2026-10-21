import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  assertLocalRequest,
  errorResponse,
  jsonError,
  readJsonBody,
  zodError,
} from '@/server/http'
import { downloadPaths } from '@/server/paths'
import { getGeneration } from '@/server/repos/generations'
import { sessionRequired } from '@/server/session'

const BodySchema = z.object({
  path: z.string().trim().min(1),
  overwrite: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

/** Copies a finished video to a user-chosen absolute path. */
export async function POST(request: Request, { params }: Params) {
  try {
    if (!sessionRequired()) return jsonError({ status: 404, error: 'Not found' })
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return zodError(body.error)

    const target = body.data.path
    if (!path.isAbsolute(target)) return jsonError({ status: 400, error: 'Path must be absolute' })
    if (path.extname(target).toLowerCase() !== '.mp4') return jsonError({ status: 400, error: 'Only .mp4 files' })

    const { id } = await params
    const record = await getGeneration(id)
    if (!record) return jsonError({ status: 404, error: 'Video not found' })

    const source = downloadPaths(record.id).video
    const exists = await fs.stat(source).then((stats) => stats.isFile(), () => false)
    if (!exists) return jsonError({ status: 404, error: 'Video not found' })

    const existing = await fs.lstat(target).catch(() => null)
    if (existing && !existing.isFile()) return jsonError({ status: 400, error: 'Target must be a regular file' })

    const flags = body.data.overwrite ? 0 : constants.COPYFILE_EXCL
    try {
      await fs.copyFile(source, target, flags)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return jsonError({ status: 409, error: 'File already exists' })
      }
      throw error
    }
    return Response.json({ path: target }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
