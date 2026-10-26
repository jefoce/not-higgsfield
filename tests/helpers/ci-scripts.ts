import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SCRIPTS = path.resolve('.github/scripts')
const tempDirs: string[] = []

export interface RunParams {
  script: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export function runScript(params: RunParams) {
  const { script, args = [], cwd = process.cwd(), env = process.env } = params

  return spawnSync('bash', [path.join(SCRIPTS, script), ...args], {
    cwd,
    env,
    encoding: 'utf8',
  })
}

export function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-ci-'))

  tempDirs.push(dir)

  return dir
}

export function cleanupTempDirs() {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export function writeFiles(root: string, files: string[]) {
  fs.mkdirSync(root, { recursive: true })

  for (const name of files) {
    fs.writeFileSync(path.join(root, name), name)
  }
}

export function gitRepo(subject: string) {
  const root = tempDir()

  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"0.2.0"}\n')
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'ci@example.com'], { cwd: root })
  execFileSync('git', ['config', 'user.name', 'CI'], { cwd: root })
  execFileSync('git', ['add', 'package.json'], { cwd: root })
  execFileSync('git', ['commit', '-qm', subject], { cwd: root })

  return root
}

export function parseOutput(stdout: string) {
  return Object.fromEntries(
    stdout
      .trim()
      .split('\n')
      .map((line) => {
        const index = line.indexOf('=')

        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

const FAKE_ORAS = `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" != pull ]]; then exit 1; fi
if [[ "\${2:-}" == *missing* ]]; then exit 1; fi
out=""
shift
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-o" ]]; then out=$2; shift 2; else shift; fi
done
mkdir -p "$out/nested/deep"
printf tool > "$out/nested/deep/ffmpeg-x"
printf '{}' > "$out/nested/deep/manifest.json"
`

export function fakeOrasEnv() {
  const root = tempDir()
  const bin = path.join(root, 'bin')

  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'oras'), FAKE_ORAS, { mode: 0o755 })

  const basePath = execFileSync('printenv', ['PATH'], { encoding: 'utf8' })

  return { root, env: { ...process.env, PATH: `${bin}:${basePath.trim()}` } }
}
