import type { SystemCapabilities } from '@/core/types'
import { assertLocalRequest, errorResponse } from '@/server/http'
import { getSystem } from '@/server/system'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const dialog = await getSystem().canChooseFiles()
    const result: SystemCapabilities = {
      chooseFiles: dialog,
      chooseFolder: dialog,
      platform: process.platform,
    }
    return Response.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
