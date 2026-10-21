import { assertLocalRequest, errorResponse } from '@/server/http'
import { getRemoteStore } from '@/server/remote/remote-store'

/** Tells the client whether cloud storage exists, so validation can warn early. */
export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    return Response.json({
      configured: getRemoteStore() !== null,
      mock: Boolean(process.env.REMOTE_MOCK?.trim()),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
