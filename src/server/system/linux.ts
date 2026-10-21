import 'server-only'

import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { acceptForKinds } from '@/core/media-kinds'
import type { MediaKind } from '@/core/types'
import { HttpError } from '../http'
import type { SystemAdapter } from './index'

const run = promisify(execFile)
const DIALOG_TIMEOUT = 10 * 60_000

type Picker = 'zenity' | 'kdialog'

export const linux: SystemAdapter = {
  canChooseFiles: async () => (await picker()) !== null,

  async chooseFiles({ kinds, multiple, prompt }) {
    const tool = await picker()
    if (!tool) throw new HttpError(501, 'No file dialog available')
    const files = extensions(kinds)
    const args = tool === 'zenity'
      ? zenityFiles(files, multiple, prompt)
      : kdialogFiles(files, multiple, prompt)
    const { stdout } = await dialog(tool, args)
    return lines(stdout)
  },

  async chooseFolder({ prompt }) {
    const tool = await picker()
    if (!tool) throw new HttpError(501, 'No folder dialog available')
    const args = tool === 'zenity'
      ? ['--file-selection', '--directory', `--title=${prompt}`]
      : ['--getexistingdirectory', os.homedir(), '--title', prompt]
    const { stdout } = await dialog(tool, args)
    return stdout.trim() || null
  },

  async reveal(file) {
    await run('xdg-open', [path.dirname(file)])
  },
}

function extensions(kinds: readonly MediaKind[]): string[] {
  return acceptForKinds(kinds)
    .split(',')
    .filter(Boolean)
    .map((ext) => ext.slice(1))
}

function zenityFiles(files: string[], multiple: boolean, prompt: string): string[] {
  const patterns = files.map((ext) => `*.${ext}`).join(' ')
  return [
    '--file-selection',
    `--title=${prompt}`,
    `--file-filter=Media | ${patterns}`,
    ...(multiple ? ['--multiple', '--separator=\n'] : []),
  ]
}

function kdialogFiles(files: string[], multiple: boolean, prompt: string): string[] {
  const patterns = files.map((ext) => `*.${ext}`).join(' ')
  return [
    '--getopenfilename',
    os.homedir(),
    `${patterns}|Media`,
    '--title',
    prompt,
    ...(multiple ? ['--multiple', '--separate-output'] : []),
  ]
}

function lines(stdout: string): string[] {
  return stdout.split('\n').map((line) => line.trim()).filter(Boolean)
}

async function picker(): Promise<Picker | null> {
  if (await hasCommand('zenity')) return 'zenity'
  if (await hasCommand('kdialog')) return 'kdialog'
  return null
}

async function hasCommand(name: string): Promise<boolean> {
  return run('which', [name], { timeout: 5_000 }).then(() => true, () => false)
}

async function dialog(file: string, args: string[]) {
  try {
    return await run(file, args, { timeout: DIALOG_TIMEOUT, killSignal: 'SIGKILL' })
  } catch (error) {
    if (isCancel(error)) return { stdout: '', stderr: '' }
    throw error
  }
}

function isCancel(error: unknown): boolean {
  const err = error as { code?: number | string }
  return Number(err.code) === 1
}
