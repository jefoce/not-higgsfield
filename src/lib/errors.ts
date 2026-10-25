/** Message safe to show in a toast, with a custom fallback. */
export function errorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
