import { DEFAULT_PRESET_ID, findPreset } from '@/core/presets'
import { VIDEO_PROVIDER_IDS } from '@/core/providers/types'
import { errorResponse, jsonError } from '@/server/http'
import { getVideoProvider } from '@/server/providers/registry'
import { assertLocalRequest } from '@/server/request-guard'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const presetId = new URL(request.url).searchParams.get('preset') ?? DEFAULT_PRESET_ID
    const preset = findPreset(presetId)

    if (!preset) {
      return jsonError({ status: 400, error: 'Unknown model' })
    }

    return Response.json(await getVideoProvider(VIDEO_PROVIDER_IDS[0]).getPricing(preset))
  } catch (error) {
    return errorResponse(error)
  }
}
