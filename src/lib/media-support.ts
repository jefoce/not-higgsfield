const cache = new Map<string, boolean>()

/** Browser support for a media MIME type. SSR stays optimistic. */
export function canPlay(mime: string): boolean {
  if (typeof document === 'undefined') return true

  let value = cache.get(mime)
  if (value === undefined) {
    const element = document.createElement(mime.startsWith('audio/') ? 'audio' : 'video')
    value = element.canPlayType(mime) !== ''
    cache.set(mime, value)
  }
  return value
}

/** Clears the MIME cache. Tests only. */
export function __resetCanPlayCache(): void {
  cache.clear()
}
