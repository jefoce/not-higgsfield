import { z } from 'zod'

import { assertLocalRequest, errorResponse, readJsonBody, zodError } from '@/server/http'
import { testConnection } from '@/server/services/connection-test'

const BodySchema = z.object({ target: z.enum(['openrouter', 'r2']) })

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    return Response.json(await testConnection(body.data.target))
  } catch (error) {
    return errorResponse(error)
  }
}
