# AGENTS.md

Rules for coding agents working in this repo. Setup, scripts and how-tos are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Before saying done

```bash
pnpm typecheck && pnpm lint && pnpm knip && pnpm test && pnpm build
```

- Also run `pnpm desktop:build` and `pnpm smoke` when touching `src-tauri`, `scripts/`, `next.config.ts` or anything the sidecar loads.
- Before reporting that a UI change works or that a UI bug exists: `rm -rf .next`, check in `pnpm dev`, and rebuild the desktop bundle for desktop checks. A stale cache already caused one false bug report.
- Report what was verified and what was not. Measured numbers say "measured", guesses say "estimate".

## Hard rules

- No `process.env` reads of key values outside `src/server/secrets`. Use `getSecret()` after `awaitSecrets()`.
- No `@tauri-apps/*` imports outside `src/lib/platform/desktop.ts`.
- Every API route calls `assertLocalRequest` before work. Health and session opt out of only the session check.
- Never log secrets, full keys, presigned URLs or account ids. Status may show the last four characters.
- `src/core` imports nothing from `server`, `features` or `lib`.
- Bounds and tunables live in `src/core/constants.ts`. Docs tables are tested against them.
- Model data lives in `src/core/presets/<family>/<model>.ts`. No code outside `src/core/presets` branches on a preset id, slug, title or family. Lint enforces it.
- Change a preset only with a source link (provider docs or a real-key test) in the commit message and in a comment next to the value.
- Do not add a dependency for something the stdlib or an installed package already does.
- No focus rings. Keyboard focus uses the `:focus-visible` hover UI, never `focus-visible:ring-*`. Mouse clicks do not leave buttons focused (`usePointerBlur`), menus excepted.

## Mock first

- `OPENROUTER_MOCK=1` for any change that touches generation. Mock jobs cost nothing and cover pending, in progress, completed and `[fail]`.
- `REMOTE_MOCK=1` replaces R2 locally.
- One suite: `pnpm vitest run tests/your-file.test.ts`.
- Real-key runs only when asked. Say which preset, settings and inputs were used.

## TypeScript

- No `any`. Use `unknown` plus a zod schema or a type guard.
- Data from outside (OpenRouter responses, request bodies, JSON files on disk, localStorage) is parsed with zod. Types come from `z.infer`, never hand-written next to a schema.
- One type per API shape, in `src/core`, imported by both the route and the client. No copies of a response type in a component.
- `satisfies` for literal config objects (presets, tables). `as const` for fixed lists.
- No nested ternaries. Use early returns or a lookup table.
- Required props and fields stay required. Do not make a value optional and then guard against undefined downstream.

### Parameters

- Up to 2 arguments: positional.
- 3 or more: one object named `params` with an exported or local `interface <Name>Params`. Destructure on the first line of the body, never in the signature.

```ts
interface CopyUniqueParams {
  source: string
  dir: string
  base: string
}

async function copyUnique(params: CopyUniqueParams): Promise<string> {
  const { source, dir, base } = params
  // ...
}
```

- Components follow the same rule with `props`: `function HistoryRow(props: HistoryRowProps)`, then `const { record } = props` on the first line.
- Hooks with 3 or more inputs take `params` too (`useVideoState(params)`).
- Exceptions: callbacks with a fixed signature (event handlers, `map`/`filter`/`reduce`, zustand `set`, `Array.sort`), route handlers (`request`, `{ params }` from Next), and tiny private helpers where the call reads like math (`clamp(value, min, max)`).

## React

- Function components and hooks only.
- One exported component per file. The file name matches the main export. Files stay near 200 lines; split by component or job, never by squeezed formatting.
- `'use client'` only in files that use state, effects, browser APIs or event handlers.
- Props type is `interface <Component>Props`. Export it only when another file uses it.
- `useMemo` and `useCallback` only for values passed to a memoized child or used in a dependency array. Not by default.
- zustand: always subscribe with a selector, `useStore((state) => state.x)`. Never `useStore()` for the whole store.
- Server data goes through SWR with keys from `src/lib/swr-keys.ts`. No `fetch` inside `useEffect` for data SWR can own.
- Browser storage only through `src/lib/local-store.ts` (try/catch plus zod). Never `localStorage` directly.
- Toasts (`sonner`) only in `src/features`. `src/core` and `src/server` never show UI.
- Icon-only buttons have `aria-label`. Decorative lucide icons have `aria-hidden`.
- Card and row click handlers start with `isOwnEvent(event)`. Portal content (menus, popovers, dialogs) bubbles through React.

### Conditional rendering

- Render-or-nothing uses `&&`, not a ternary with `null`:

```tsx
{record.favorite && <HeartButton record={record} />}
```

- The left side must be a real boolean. Numbers and strings render `0` or `""` otherwise. Compare or coerce:

```tsx
{selected.length > 0 && <SelectionBar records={records} />}
{Boolean(poster) && <img src={poster} alt="" />}
```

- A ternary only when both branches render something: `{completed ? <LazyVideo /> : <StatusOverlay />}`.
- ESLint `react/jsx-no-leaked-render` with `validStrategies: ['coerce']` enforces the boolean left side.

## UI building blocks

- Before writing a new component, hook or helper, search `src/ui`, `src/ui/form`, `src/lib` and the feature folder. Reuse it, or extend it with a variant.
- New buttons, popovers, modals, tooltips, sliders and fields use `src/ui`. A raw `<button>` is fine only for overlay icon controls that share one class constant.
- Single-choice pickers close on pick. Multi-toggle panels (Filter) stay open until click outside or Escape.
- `<img>` is correct for posters and thumbs from `/api/thumbs` and `/api/media` (already sized by the server). Keep the eslint-disable with its reason. Do not switch them to `next/image`.

## Styling

- Tailwind v4 with tokens from `@theme` in `src/app/globals.css`. Merge classes with `cn()` from `src/lib/cn.ts`.
- No new hex colors in class names. Add a token to `@theme` first, then use it.
- Spacing and sizes from the Tailwind scale. Arbitrary values `[...]` only when no scale value fits.
- Do not restate defaults (`flex-row`, `static`, `font-normal` on plain text).
- Named groups (`group/card`, `group/player`) when a `group` sits inside another `group`.
- Hidden overlays are not rendered, or are `pointer-events-none`. Nothing invisible may catch hover or clicks.

## Server

- Every file in `src/server` starts with `import 'server-only'`.
- Route handlers: `assertLocalRequest`, then `safeParse` with zod and `zodError` on failure, then work. Errors go through `errorResponse`. Throw `HttpError` for expected failures.
- Long work never runs inside a route handler. Queue it in `src/server/jobs`.
- Record writes go through the per-record lock (`withLock`). Never read-modify-write a record without it.
- Provider error text is stored raw. Translation to plain words happens at render time (`core/provider-errors.ts`).

## Style

- Terse. Short sentences. No hype, no filler, no em dashes in prose or comments.
- Comments explain why, not what. JSDoc for block docs, inline notes only inside a function.
- Early returns over nested branches. Lookup tables over if/else chains that only return.
- Smallest diff that solves the problem. No drive-by refactors outside the files you touch.
- Fix every rule violation in the files you touch in one pass, not only the line you changed.
- Never squeeze formatting (joined lines, removed blank lines) to hit a line count. Split the file instead.
- Use the package the file already imports. `lodash-es` is available in both trees.

## Where to look

| Topic | Document |
|---|---|
| Setup, scripts, mock modes, desktop build, ffmpeg and Node builds, adding a model, debugging, release | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Runtime, data model, lifecycle, concurrency, bounds, edge cases | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Threat model and controls | [docs/SECURITY.md](docs/SECURITY.md) |
| Why a design exists | [docs/DECISIONS.md](docs/DECISIONS.md) |
| User-facing behavior | [README.md](README.md) |

## Quick map

- Routes: `src/app/api`
- Jobs: `src/server/jobs` (`submit-queue`, `run-submit`, `submit-media`, `submit-record`, `poller`, `download-queue`, `generation-actions`)
- Repos: `src/server/repos`
- Media: `src/server/media` (`ffmpeg`, `to-data-url`, `thumbs`, `compat`)
- Presets: `src/core/presets` (one file per model, `index.ts` holds the list)
- History: `src/features/history` (`record-view` helpers, `record-actions`, `selection-store`, `view-store`)
- Validation: `src/core/validation.ts`
- Provider errors: `src/core/provider-errors.ts`
- Secrets: `src/server/secrets`
- Platform bridge: `src/lib/platform`
- Shared UI: `src/ui`, `src/ui/form`
- Desktop shell: `src-tauri/src`
- ffmpeg build: `scripts/ffmpeg`
