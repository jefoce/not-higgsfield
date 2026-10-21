type HistoryRefresh = () => Promise<unknown>

let historyRefresh: HistoryRefresh | null = null

/** Registers the mounted infinite hook so global callers can revalidate it. */
export function registerHistoryRefresh(refresh: HistoryRefresh | null): void {
  historyRefresh = refresh
}

/** Revalidates the registered infinite history hook, if any. */
export function refreshHistory(): Promise<unknown> {
  return historyRefresh?.() ?? Promise.resolve()
}
