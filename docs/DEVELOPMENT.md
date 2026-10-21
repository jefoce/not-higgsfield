# Development

## 1. Requirements

| Tool | Version |
|---|---|
| Node | 22 (repo pins 22.23.3 in the desktop build) |
| pnpm | 10 or newer (repo pins 12.14.0) |
| Rust | stable via [rustup](https://rustup.rs), 1.90 or newer for the desktop app |
| Xcode Command Line Tools | macOS desktop builds |

## 2. First run

```bash
pnpm install
cp .env.example .env.local
```

Set `OPENROUTER_MOCK=1` in `.env.local` for local work, then:

```bash
pnpm dev
```

The dev server binds to 127.0.0.1:3000. Data goes to `~/.not-higgsfield` unless `STORAGE_ROOT` overrides it.

## 3. Scripts

| Script | Action |
|---|---|
| `pnpm dev` | Next dev server on 127.0.0.1 |
| `pnpm build` | Production build, standalone output |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest, all suites, once |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm desktop:prepare` | Build and stage the server, Node and ffmpeg sidecars |
| `pnpm desktop:dev` | Tauri window against the dev server, no sidecar |
| `pnpm desktop:build` | macOS app and dmg |
| `pnpm ffmpeg:build` | Build the pinned GPL ffmpeg into the local cache |
| `pnpm notices` | Regenerate npm notices, copy notices and LICENSE into resources |
| `pnpm smoke` | Run the staged server smoke test |
| `pnpm tauri` | Pass a command to the Tauri CLI |

## 4. Mock modes

| Variable | Effect |
|---|---|
| `OPENROUTER_MOCK=1` | Local timeline. Pending for 3 s (`MOCK_QUEUE_MS`), in progress for 6 s (`MOCK_GENERATE_MS`), then a locally generated video. No API key needed and no cost. |
| `REMOTE_MOCK=1` | Local R2 replacement, only honored together with mock OpenRouter. Links point at the local server. |
| `REMOTE_MOCK_MBPS` | Throttles mock uploads, default 20. |
| `REMOTE_MOCK=fail` | Every mock upload fails. |
| `[fail]` in the prompt | Mock job ends as failed. |

Mock mode keeps the Test button enabled without stored keys.

## 5. Adding a model

1. Find the provider docs and the OpenRouter slug. Check `/api/v1/videos/models` for `supported_*` fields and `pricing_skus`.
2. Same family as an existing model: add `src/core/presets/<family>/<model>.ts` with only what differs from `family.ts`. New family: add `src/core/presets/<family>/family.ts` with references, `referenceLimits` for every media kind it accepts, `errors`, `contentPolicy`, `icon`.
3. Add it to `MODEL_PRESETS` in `src/core/presets/index.ts` (the order is the picker order).
4. Put a source link in a comment next to every limit, and in the commit message.
5. `pnpm vitest run tests/presets-contract.test.ts`. It checks defaults, duration options, sizes, pricing keys, reference limits and the error table.
6. One real-key run with a prompt, then one with each reference kind. Record anything learned (for example `promptOptional`, the billing floor, `contentPolicy`) in the preset with the date.
   Never branch on a preset id outside `src/core/presets`. Add a preset field instead.

## 6. Environment variables

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Required for real generation |
| `OPENROUTER_MANAGEMENT_KEY` | Optional, adds balance to the credits pill |
| `OPENROUTER_MOCK` | `1` turns on the mock provider |
| `STORAGE_ROOT` | Data folder, default `~/.not-higgsfield` |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 token access key |
| `R2_SECRET_ACCESS_KEY` | R2 token secret |
| `R2_BUCKET` | Bucket name |
| `REMOTE_LINK_TTL_SEC` | Presigned link lifetime in seconds, default 7200 |
| `REMOTE_UNUSED_DAYS` | R2 retention in days, default 30 |
| `REMOTE_MOCK` | Local R2 mock, `1` or `fail` |
| `REMOTE_MOCK_MBPS` | Mock upload speed |
| `APP_TOKEN` | Desktop session token, set by Tauri |
| `PARENT_PID` | Tauri process id, set by Tauri. The server exits when it disappears. |
| `PORT`, `HOSTNAME` | Server bind address |
| `NH_SECRETS_BACKEND` | `file` forces the file backend, for debugging keychain issues |
| `APP_ORIGIN` | Origin used by mock remote links |

Env values override stored keys and are read-only in Settings.

## 7. Tests

Suite layout: `tests/*.test.{ts,tsx}`. Most tests cover `src/core` pure logic, route helpers, repos, locks and secrets with fake backends in the Node environment. Component tests opt in per file with `// @vitest-environment jsdom` and Testing Library.

Run one file:

```bash
pnpm vitest run tests/presets.test.ts
```

Watch mode:

```bash
pnpm vitest
```

`tests/docs.test.ts` checks the README status table, the architecture models and bounds tables, and that relative doc links exist.

## 8. Lint and dead code

`pnpm lint` runs ESLint. `pnpm knip` reports unused files, exports and dependencies. Clear findings before adding it to the lint script.

`.github/workflows/ci.yml` runs typecheck, lint, knip, tests and build on every push and pull request. The release workflow runs the same checks, plus a non-blocking `pnpm audit --prod --audit-level high`. Dependabot (`.github/dependabot.yml`) opens weekly grouped minor and patch updates for npm, cargo and GitHub Actions.

## 9. Code shape rules

- Keep files near 200 lines or less. Split by component or job, not by squeezed formatting.
- One exported component per file. The file name matches the main export. Private subcomponents stay in the same file only when they exist for one caller.
- Components take one `props` object: `function Row(props: RowProps)`, then `const { record } = props` on the first line.
- Functions and hooks with three or more inputs take one `params` object. Two or fewer may stay positional.
- Named exports. A default export only where Next requires it (`page.tsx`, `layout.tsx`).
- Import direction: `core` imports nothing from `server`, `features` or `lib`. Only `lib/platform/desktop.ts` imports `@tauri-apps/*`.
- One type per API shape lives in `src/core`. Data from outside is parsed with zod, and types come from `z.infer`.
- Never branch on a preset id, slug or family outside `src/core/presets`. Add a preset field instead.
- No focus rings. Keyboard focus uses the `:focus-visible` hover UI, never `focus-visible:ring-*`.
- Mock first: `OPENROUTER_MOCK=1` for generation work, `REMOTE_MOCK=1` for storage work.

## 10. Desktop build

`pnpm desktop:prepare` runs a Next build, then `scripts/prepare-desktop.mjs`:

1. Copies `.next/standalone` and `.next/static` into `src-tauri/resources/server`, skipping env files, docs, sources, tests and build caches.
2. Removes traced ffmpeg binaries. Desktop uses the separate ffmpeg sidecar.
3. Prunes the staged server in groups and prints the size of each: source maps, type declarations, docs (license and notice files stay), `test` and `__tests__` folders, build traces (`.nft.json`, `.DS_Store`) and `next/dist/compiled/@vercel/og` when present. The smoke run proves the remaining chunks load. Root images, lockfiles, configs and CI/IDE entries are deleted too. Only `package.json`, `server.js`, `.next`, `node_modules`, `public` and license notices stay at the root.
4. Downloads the pinned Node 22.23.3 binary, verifies `SHASUMS256.txt`, and stages it as the server sidecar.
5. Copies a custom ffmpeg build and stages it with the Rust target triple. `FFMPEG_BINARY` wins, then the cache path `~/.cache/not-higgsfield-build/ffmpeg/<version>-<profile>/<triple>/ffmpeg-<triple>`, read from `scripts/ffmpeg/versions.env` and `FFMPEG_PROFILE` (default `full`). The `ffmpeg-static` fallback needs `ALLOW_NONFREE_FFMPEG=1`; CI requires `FFMPEG_BINARY`. Custom builds run `scripts/ffmpeg/verify.sh`.
6. Reads `ffmpeg -buildconf`, prints the chosen path, size and license flags, and fails on `--enable-nonfree`. Custom builds are GPL only, so releases use them.
7. Runs every `serverExternalPackages` entry and the native platform packages from the staged tree, so a missing or unhoisted module fails the build.
8. Prints staged sizes and the bytes pruned.
9. Release builds use `[profile.release]` in `src-tauri/Cargo.toml`: `codegen-units = 1`, `lto = true`, `opt-level = "s"` and `strip = true`. Panic unwinding stays on so the hook keeps writing to `desktop.log`.

`pnpm notices` regenerates the npm section of `THIRD_PARTY_NOTICES.md` from `pnpm licenses list --prod --json`, then copies it and `LICENSE` into `src-tauri/resources`. `prepare-desktop.mjs` copies `licenses/` into `src-tauri/resources/licenses`. `desktop:prepare` runs both.

`pnpm smoke` runs `scripts/smoke-server.mjs` against the staged target: starts the sidecar with a temp `STORAGE_ROOT`, opens a session, saves a file-backend secret, links a fixture image, submits a Wan 3.0 frames job in mock mode, fetches the video and thumb, then shuts down and checks `server.lock` is gone. Run it after `pnpm desktop:prepare`. Pass `--target <triple>` to test another staged platform.

Sidecars: `not-higgsfield-server-<target-triple>` is the Node runtime, `ffmpeg-<target-triple>` is ffmpeg. Tauri lists both as external binaries and injects `PORT`, `HOSTNAME=127.0.0.1`, `APP_TOKEN` and `PARENT_PID`.

Desktop does not run the server from `Contents/Resources/server`. On first launch it copies that folder to `~/.not-higgsfield/runtime/<app version>`, stages the copy in a hidden `.staging-<pid>` folder, then renames it into place. Later launches reuse the copy. The sidecar runs with that folder as its cwd, so Next writes `.next/cache` there and the bundle resources stay untouched. The ad-hoc signature seal stays valid after running and quitting. A version bump stages a fresh copy and removes older runtime folders after readiness.

The bundle sets `LSUIElement` so the sidecar gets no Dock tile. Next sets `process.title`, which makes LaunchServices re-register the Node child under the app bundle id; agent bundles default to `UIElement`. `main.rs` restores `Regular` for the shell, so only one Dock entry remains.

That policy flip can leave WebKit treating the webview as inactive, which on macOS 14+ throttles rendering to a few fps. Every window is built with `BackgroundThrottlingPolicy::Disabled` and the app activates on launch, so the UI stays at full frame rate while another app is frontmost.

Entitlements in `src-tauri/Entitlements.plist`:

| Entitlement | Why |
|---|---|
| `allow-jit` | JavaScriptCore needs JIT for the webview |
| `allow-unsigned-executable-memory` | JIT code pages on hardened runtime |
| `disable-library-validation` | Loads the staged server and native modules signed ad hoc |

Signing is ad hoc (`signingIdentity: "-"`). Rebuilds count as a new program to macOS, so Keychain prompts can return.

Measured on 2026-10-21, macOS arm64: DMG 62.72 MiB, installed app 181.76 MiB. Inside the app: server 44.7 MiB, Node 107.7 MiB, ffmpeg 22.1 MiB. First launch stages a 44.7 MiB runtime copy in about 2.4 s and is ready in about 4.4 s; later launches are ready in under 1 s.

Build per architecture. arm64 builds on Apple Silicon. x64 needs an Intel Mac, or an x64 Node and matching native modules.

## 11. Own ffmpeg build

- `pnpm ffmpeg:build` builds the redistributable ffmpeg for this machine into `~/.cache/not-higgsfield-build/ffmpeg/<version>-<profile>/<triple>/`. `pnpm desktop:build` picks it up from there.
- ffmpeg 9.0.2 with the `full` profile lands in `~/.cache/not-higgsfield-build/ffmpeg/9.0.2-full/<triple>/ffmpeg-<triple>`. The full build has x264, AAC, PNG, MJPEG, WebP and the filters the app uses, and no nonfree components.
- Versions and SHA-256 sums: `scripts/ffmpeg/versions.env`. Flags: `scripts/ffmpeg/profile-*.txt`. Changing any file in `scripts/ffmpeg/` rebuilds it in CI.
- Sources download from `$BUILD_SOURCES_URL/<file>` first. The default is the `build-sources` release in this repo, which holds the three verified archives uploaded once from the `ffmpeg-sources` artifact of the first green CI run. ffmpeg.org, the x264 GitLab archive and zlib (fossils, then the GitHub mirror) are fallbacks. The pinned SHA-256 stays the authority.
- `FFMPEG_PROFILE=minimal` uses the small profile. Build it with `bash scripts/ffmpeg/build-unix.sh --profile minimal`, then set `FFMPEG_PROFILE=minimal` when preparing.
- `FFMPEG_BINARY=<path>` uses a specific binary. CI always sets it.
- `scripts/ffmpeg/verify.sh <binary>` checks the license flags, the codecs, the filters and every command the app runs, using `tests/fixtures/media/`.
- Windows cross-builds on Linux with `bash scripts/ffmpeg/build-windows.sh` and mingw-w64.
- `ALLOW_NONFREE_FFMPEG=1` falls back to `ffmpeg-static` for local builds only. The result is not redistributable. CI refuses it.
- `pnpm dev` uses `ffmpeg-static` from `node_modules`. `FFMPEG_PATH` overrides it.
- Pass `--sources <dir>` to copy the three verified source archives out for release assets. The script also writes `buildconf.txt` next to the binary.

Measured on macOS arm64: full 22.1 MiB, minimal 8.9 MiB, `ffmpeg-static` fallback 43.5 MiB.

## 12. Own Node build (planned, v19 Z2)

Not built yet. No `pnpm node:build` script and no `NODE_BINARY` handling exist. Until it lands, `prepare-desktop.mjs` downloads the official Node 22.23.3 binary and verifies `SHASUMS256.txt`.

Planned: build Node with `small-icu` into `~/.cache/not-higgsfield-build/node/<version>/<triple>/`, cache it by script hash in CI, and save an estimated 25-30 MB. The first build is slow because Node compiles from source.

## 13. Debugging

### Stale builds

Before reporting a UI bug or checking a UI change:

```bash
rm -rf .next
pnpm dev
```

For the desktop app also clear the old bundle before `pnpm desktop:build`:

```bash
rm -rf src-tauri/target/*/release/bundle
```

If `bundle_dmg.sh` was interrupted, delete the leftover `rw.*.dmg` next to the bundle.

| Task | How |
|---|---|
| Server log | `~/.not-higgsfield/logs/server.log`, rotated at 5 MB into `.log.1` to `.log.3` |
| Health | `curl http://127.0.0.1:47821/api/health` shows app, pid, desktop and ready |
| Run the packaged server by hand | See below |
| Open a desktop session | Open `http://127.0.0.1:47821/api/session?t=test` |
| Kill a stuck sidecar | Quit the app, then `pkill -f not-higgsfield-server` |
| Reset the instance lock | Quit every instance, then delete `~/.not-higgsfield/server.lock` |
| Force the file keychain backend | Start the server with `NH_SECRETS_BACKEND=file` |
| Port | `desktop.json`, default 47821. A busy port falls back to a free one. |

Run the packaged server without Tauri:

```bash
cd src-tauri/resources/server
PORT=47821 HOSTNAME=127.0.0.1 APP_TOKEN=test \
  ../../binaries/not-higgsfield-server-<target-triple> server.js
```

Then open `http://127.0.0.1:47821/api/session?t=test`.

## 14. Release checklist

Pushing a tag that starts with `v` runs `.github/workflows/release.yml`. An `ffmpeg` job builds macOS arm64, Linux and Windows cross sidecars in parallel, caches by `hashFiles('scripts/ffmpeg/**')`, and uploads one artifact per target plus the verified source archives. The macOS, Windows and Linux build jobs download their sidecar, run `scripts/ffmpeg/verify.sh`, set `FFMPEG_BINARY`, then run the checks, stage the server, run `scripts/smoke-server.mjs`, and build installers. `NH_PREPARED=1` makes `tauri-action` reuse the staged target instead of staging it twice. Each build job writes a per-target checksum artifact from its bundle. A last job merges them into `SHA256SUMS.txt`, adds the ffmpeg source hashes, and uploads the checksums and source archives to the draft release. Install each file on a real machine before publishing.

1. Bump the version in `package.json` (`src-tauri/tauri.conf.json` reads it) and add a `CHANGELOG.md` entry.
2. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
3. Run `pnpm desktop:build` and `pnpm smoke` for a local check.
4. Smoke test the packaged app: mock run works, real run with a cheap model completes, history shows the video, Settings Test passes, `server.log` has no secrets.
5. Push the tag (`git tag v0.1.0 && git push origin v0.1.0`) and wait for the draft release.
6. Install each asset on a real machine, then publish. Mention the ad-hoc macOS signature and the first-open steps in the notes.
7. First CI run per new ffmpeg or Node version takes long. Later runs hit the cache. 
8. Draft release assets: installers, `SHA256SUMS.txt`, and the ffmpeg, x264 and zlib source archives (GPL requirement). Do not delete the archives from a published release. 
9. Before the first tag: `-buildconf` and `THIRD_PARTY_NOTICES.md` contain no home paths.

## 15. Later: Developer ID and notarization

Not done yet. When an Apple Developer ID is available:

1. Replace the ad-hoc identity with the Developer ID Application certificate.
2. Sign the app, the staged Node sidecar and ffmpeg with hardened runtime and the existing entitlements.
3. Submit with `xcrun notarytool submit` and wait for acceptance.
4. Staple with `xcrun stapler staple`.
5. Re-test Keychain prompts. A stable signature should stop them returning after updates.
