import 'server-only'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import ffmpegPath from 'ffmpeg-static'
import { PREVIEW_WIDTH } from '@/core/constants'

const MAX_BUFFER = 16 * 1024 * 1024

const FFMPEG_PATH = process.env.FFMPEG_PATH?.trim() || ffmpegPath || ''

export interface FfmpegStatus {
  path: string
  exists: boolean
}

export interface MediaProbe {
  durationSec: number | null
  width: number | null
  height: number | null
}

let logged = false

/** Reports the ffmpeg binary once per process. */
export function assertFfmpeg(): FfmpegStatus {
  const exists = FFMPEG_PATH.length > 0 && existsSync(FFMPEG_PATH)
  if (!logged) {
    logged = true
    console.log('[not-higgsfield] ffmpeg', FFMPEG_PATH, exists)
  }
  return { path: FFMPEG_PATH, exists }
}

export function runFfmpeg(args: string[]): Promise<void> {
  const bin = assertFfmpeg()
  if (!bin.exists) return Promise.reject(new Error('ffmpeg binary not found'))

  return new Promise((resolve, reject) => {
    execFile(bin.path, args, { maxBuffer: MAX_BUFFER, encoding: 'utf8' }, (error, _stdout, stderr) => {
      if (!error) {
        resolve()
        return
      }
      reject(new Error(`ffmpeg failed: ${stderr.slice(-2000)}`))
    })
  })
}

interface ExtractFrameParams {
  videoPath: string
  atSec: number
  width: number
  outPath: string
}

export async function extractFrame(params: ExtractFrameParams): Promise<void> {
  const { videoPath, atSec, width, outPath } = params
  const evenWidth = Math.max(2, Math.floor(width / 2) * 2)
  await runFfmpeg([
    '-ss',
    String(atSec),
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-vf',
    `scale=${evenWidth}:-2`,
    '-y',
    outPath,
  ])
  await verifyFrame(outPath)
}

/** Reads duration and dimensions by parsing `ffmpeg -i` stderr. */
export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const stderr = await captureStderr(['-i', filePath])
  const duration = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr)
  const durationSec = duration
    ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])
    : null

  const lines = stderr.split('\n')
  const videoLine = lines.find((line) => line.includes('Video:'))
  const candidates = videoLine ? [videoLine, ...lines] : lines

  for (const line of candidates) {
    const size = /(\d{2,5})x(\d{2,5})/.exec(line)
    if (!size) continue
    const width = Number(size[1])
    const height = Number(size[2])
    if (width > 0 && height > 0) return { durationSec, width, height }
  }

  return { durationSec, width: null, height: null }
}

interface ExtractBoundaryFrameParams {
  videoPath: string
  at: 'first' | 'last'
  outPath: string
}

export async function extractBoundaryFrame(params: ExtractBoundaryFrameParams): Promise<void> {
  const { videoPath, at, outPath } = params
  if (at === 'first') {
    const probe = await probeMedia(videoPath)
    await extractFrame({ videoPath, atSec: 0, width: probe.width ?? PREVIEW_WIDTH, outPath: outPath })
    return
  }

  await runFfmpeg(['-sseof', '-1', '-i', videoPath, '-update', '1', '-q:v', '1', '-y', outPath])
  await verifyFrame(outPath)
}

async function verifyFrame(outPath: string): Promise<void> {
  const stats = await fs.stat(outPath).catch(() => null)
  if (!stats || stats.size === 0) throw new Error('Frame extraction failed')
}

export async function makeTestVideo(
  outPath: string,
  opts: { width: number; height: number; durationSec: number },
): Promise<void> {
  await runFfmpeg([
    '-f',
    'lavfi',
    '-i',
    `testsrc2=size=${opts.width}x${opts.height}:rate=24`,
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440',
    '-t',
    String(opts.durationSec),
    '-shortest',
    '-pix_fmt',
    'yuv420p',
    '-y',
    outPath,
  ])
}

function captureStderr(args: string[]): Promise<string> {
  const bin = assertFfmpeg()
  if (!bin.exists) return Promise.reject(new Error('ffmpeg binary not found'))

  return new Promise((resolve, reject) => {
    execFile(
      bin.path,
      args,
      { maxBuffer: MAX_BUFFER, encoding: 'utf8' },
      (error, _stdout, stderr) => {
        if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new Error('ffmpeg binary not found'))
          return
        }
        // `ffmpeg -i` exits non-zero without an output file; stderr still holds the probe.
        resolve(stderr)
      },
    )
  })
}
