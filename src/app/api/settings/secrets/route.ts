import { z } from 'zod'
import {
  assertLocalRequest,
  errorResponse,
  readJsonBody,
  zodError,
} from '@/server/http'
import { SECRET_NAMES, SECRET_SCHEMAS } from '@/core/secret-names'
import { secretStatus, secretsReady, setSecrets } from '@/server/secrets'

const BodySchema = z.object({
  values: z.object(
    Object.fromEntries(
      SECRET_NAMES.map((name) => [name, SECRET_SCHEMAS[name].nullable().optional()]),
    ),
  ),
})

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    void secretsReady()
    return Response.json(secretStatus())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return zodError(body.error)

    await secretsReady()
    await setSecrets(body.data.values)

    const names = Object.keys(body.data.values)
    if (names.length) console.log(`[not-higgsfield] secrets updated: ${names.join(', ')}`)
    return Response.json(secretStatus())
  } catch (error) {
    return errorResponse(error)
  }
}
