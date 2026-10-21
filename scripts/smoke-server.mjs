#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const TAURI_DIR = path.join(ROOT, 'src-tauri')
const BINARIES_DIR = path.join(TAURI_DIR, 'binaries')
const RESOURCES_DIR = path.join(TAURI_DIR, 'resources', 'server')
const SESSION_COOKIE = 'nh_session'
const HEALTH_TIMEOUT_MS = 60_000
const COMPLETE_TIMEOUT_MS = 90_000
const EXIT_TIMEOUT_MS = 10_000
const POLL_MS = 500
const args = process.argv.slice(2)

/** Target triple from `--target`, the Tauri env, or this machine. */
function targetTriple() {
  const inline = args.find((arg) => arg.startsWith('--target='))
  const requested = inline?.slice('--target='.length) ??
    (args.includes('--target') ? args[args.indexOf('--target') + 1] : undefined) ??
    process.env.TAURI_ENV_TARGET_TRIPLE
  if (requested) return requested

  const arch = { arm64: 'aarch64', x64: 'x86_64' }[process.arch]
  if (!arch) throw new Error(`Unsupported CPU architecture: ${process.arch}`)
  if (process.platform === 'darwin') return `${arch}-apple-darwin`
  if (process.platform === 'linux') return `${arch}-unknown-linux-gnu`
  if (process.platform === 'win32') return `${arch}-pc-windows-msvc`
  throw new Error(`Unsupported platform: ${process.platform}`)
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

/** Polls `fn` until it returns a value or the deadline passes. */
async function waitFor(fn, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await fn()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ''}`)
}

function envFor(root, port, ffmpeg) {
  const env = { ...process.env }
  for (const name of Object.keys(env)) {
    if (name.startsWith('OPENROUTER_') || name.startsWith('R2_') || name === 'REMOTE_MOCK') {
      delete env[name]
    }
  }
  Object.assign(env, {
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    APP_TOKEN: 'smoke',
    STORAGE_ROOT: root,
    FFMPEG_PATH: ffmpeg,
    OPENROUTER_MOCK: '1',
    NH_SECRETS_BACKEND: 'file',
    NODE_ENV: 'production',
  })
  return env
}

async function main() {
  const triple = targetTriple()
  const windows = triple.includes('windows')
  const exe = windows ? '.exe' : ''
  const serverBinary = path.join(BINARIES_DIR, `not-higgsfield-server-${triple}${exe}`)
  const ffmpeg = path.join(BINARIES_DIR, `ffmpeg-${triple}${exe}`)
  const serverJs = path.join(RESOURCES_DIR, 'server.js')

  for (const file of [serverBinary, ffmpeg, serverJs]) {
    await fs.access(file).catch(() => {
      throw new Error(`Missing ${path.relative(ROOT, file)}. Run pnpm desktop:prepare first.`)
    })
  }

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nh-smoke-'))
  const fixture = path.join(root, 'fixture.png')
  let child
  let output = ''
  let cookie = ''

  try {
    execFileSync(ffmpeg, ['-f', 'lavfi', '-i', 'color=c=red:s=640x480', '-frames:v', '1', '-y', fixture], {
      stdio: 'pipe',
    })

    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    child = spawn(serverBinary, ['server.js'], {
      cwd: RESOURCES_DIR,
      env: envFor(root, port, ffmpeg),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })))

    const api = (route, options = {}) => fetch(`${base}${route}`, {
      redirect: 'manual',
      ...options,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(options.body != null ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
    })

    await waitFor(async () => {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) })
      const body = await res.json()
      return res.ok && body.ready === true
    }, HEALTH_TIMEOUT_MS, 'Server never became ready')

    const session = await fetch(`${base}/api/session?t=smoke`, { redirect: 'manual' })
    if (session.status !== 303) throw new Error(`Session returned ${session.status}`)
    const setCookie = session.headers.get('set-cookie') ?? ''
    if (!setCookie.startsWith(`${SESSION_COOKIE}=`)) throw new Error('Session did not set a cookie')
    cookie = `${SESSION_COOKIE}=${setCookie.slice(SESSION_COOKIE.length + 1).split(';')[0]}`

    const secrets = await api('/api/settings/secrets', {
      method: 'PUT',
      body: JSON.stringify({ values: { OPENROUTER_API_KEY: 'sk-or-smoke' } }),
    })
    const secretBody = await secrets.json()
    if (secrets.status !== 200 || secretBody.keys?.OPENROUTER_API_KEY?.set !== true) {
      throw new Error(`Secrets PUT failed (${secrets.status})`)
    }

    const link = await api('/api/uploads/link', {
      method: 'POST',
      body: JSON.stringify({ absPath: fixture }),
    })
    const upload = await link.json()
    if (link.status !== 201 || !upload.id || !upload.linkMode) {
      throw new Error(`Link upload failed (${link.status})`)
    }

    const create = await api('/api/generations', {
      method: 'POST',
      body: JSON.stringify({
        presetId: 'wan-3.0',
        tab: 'frames',
        prompt: 'smoke',
        audio: false,
        duration: 5,
        aspectRatio: '16:9',
        resolution: '480p',
        frames: { start: upload.id, end: null },
        references: [],
        seed: null,
      }),
    })
    const record = await create.json()
    if (create.status !== 201 || !record.id) {
      throw new Error(`Create generation failed (${create.status}): ${JSON.stringify(record)}`)
    }

    const completed = await waitFor(async () => {
      const res = await api(`/api/generations?ids=${encodeURIComponent(record.id)}`)
      const body = await res.json()
      const item = body.items?.find((entry) => entry.id === record.id)
      if (item?.status === 'failed') throw new Error(`Generation failed: ${item.error ?? 'unknown'}`)
      const done = item?.status === 'completed' && item.output?.video && !item.download
      return done ? item : null
    }, COMPLETE_TIMEOUT_MS, 'Generation did not complete')

    const video = await api(`/api/media/downloads/${completed.id}.mp4`)
    const videoBytes = await video.arrayBuffer()
    if (video.status !== 200 || videoBytes.byteLength === 0) {
      throw new Error(`Video fetch failed (${video.status}): ${Buffer.from(videoBytes).toString('utf8').slice(0, 300)}`)
    }

    const thumb = await api(`/api/thumbs/downloads/${completed.id}.preview.png?w=320`)
    const thumbBytes = await thumb.arrayBuffer()
    if (thumb.status !== 200 || thumbBytes.byteLength === 0) {
      throw new Error(`Thumb fetch failed (${thumb.status})`)
    }

    const shutdown = await api('/api/system/shutdown', { method: 'POST' })
    if (shutdown.status !== 202) throw new Error(`Shutdown returned ${shutdown.status}`)

    const exit = await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(() => resolve(null), EXIT_TIMEOUT_MS)),
    ])
    if (!exit) throw new Error('Server did not exit after shutdown')
    if (exit.code !== 0) throw new Error(`Server exited with ${exit.code ?? exit.signal}`)

    const lock = path.join(root, 'server.lock')
    const lockExists = await fs.stat(lock).then(() => true, () => false)
    if (lockExists) throw new Error('server.lock was not removed')

    console.log(`[smoke] ${triple}: health, session, secrets, link, frames job, media, thumb, shutdown`)
  } catch (error) {
    const lines = output.split(/\r?\n/).filter(Boolean).slice(-100)
    if (lines.length) console.error(`[smoke] last ${lines.length} server lines:\n${lines.join('\n')}`)
    throw error
  } finally {
    if (child && child.exitCode === null) child.kill()
    await fs.rm(root, { recursive: true, force: true })
  }
}

try {
  await main()
} catch (error) {
  console.error(`[smoke] ${error.message}`)
  process.exit(1)
}
