import { isNil } from 'lodash-es'

import { errorResponse } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { secretsReady } from '@/server/secrets'
import { getObjectStore } from '@/server/storage/registry'

/** Tells the client whether cloud storage exists, so validation can warn early. */
export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    await secretsReady()

    return Response.json({
      configured: !isNil(getObjectStore()),
      mock: Boolean(process.env.REMOTE_MOCK?.trim()),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
