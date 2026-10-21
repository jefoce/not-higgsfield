import { renderPromptForApi } from './prompt-tokens'
import type { GenerationInput, MediaKind } from './types'
import type { ModelPreset } from './presets'

export interface ResolvedMedia {
  id: string
  kind: MediaKind
  url: string
}

interface OpenRouterFramePart {
  type: 'image_url'
  image_url: { url: string }
  frame_type: 'first_frame' | 'last_frame'
}

type OpenRouterReferencePart =
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'video_url'; video_url: { url: string } }
  | { type: 'audio_url'; audio_url: { url: string } }

export interface OpenRouterVideoBody {
  model: string
  duration: number
  resolution: string
  generate_audio?: boolean
  prompt?: string
  seed?: number
  aspect_ratio?: string
  frame_images?: OpenRouterFramePart[]
  input_references?: OpenRouterReferencePart[]
}

const framePart = (media: ResolvedMedia, frameType: 'first_frame' | 'last_frame'): OpenRouterFramePart => ({
  type: 'image_url',
  image_url: { url: media.url },
  frame_type: frameType,
})

const referencePart = (media: ResolvedMedia): OpenRouterReferencePart => {
  if (media.kind === 'image') return { type: 'image_url', image_url: { url: media.url } }
  if (media.kind === 'video') return { type: 'video_url', video_url: { url: media.url } }
  return { type: 'audio_url', audio_url: { url: media.url } }
}

export interface BuildOpenRouterBodyParams {
  input: GenerationInput
  preset: ModelPreset
  media: Record<string, ResolvedMedia>
}

export function buildOpenRouterBody(params: BuildOpenRouterBodyParams): OpenRouterVideoBody {
  const { input, preset, media } = params
  const body: OpenRouterVideoBody = {
    model: preset.slug,
    duration: input.duration,
    resolution: input.resolution,
  }
  if (preset.audio.supported) body.generate_audio = input.audio

  const prompt = input.prompt.trim()
  if (prompt) body.prompt = renderPromptForApi(prompt, preset)
  if (input.seed != null && preset.seed) body.seed = input.seed
  if (input.aspectRatio !== 'auto') body.aspect_ratio = input.aspectRatio

  if (input.tab === 'frames') {
    const frames: OpenRouterFramePart[] = []
    if (preset.frames.start && input.frames.start) {
      frames.push(framePart(media[input.frames.start], 'first_frame'))
    }
    if (preset.frames.end && input.frames.start && input.frames.end) {
      frames.push(framePart(media[input.frames.end], 'last_frame'))
    }
    if (frames.length) body.frame_images = frames
  } else if (input.references.length) {
    body.input_references = input.references.map((id) => referencePart(media[id]))
  }

  return body
}
