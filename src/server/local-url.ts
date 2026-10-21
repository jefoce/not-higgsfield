import 'server-only'

/** Local server origin used by mock links and prefix checks. */
const LOCAL_BASE_URL =
  process.env.APP_ORIGIN?.trim() || `http://127.0.0.1:${process.env.PORT ?? 3000}`

export const MOCK_REMOTE_PREFIX = `${LOCAL_BASE_URL}/api/dev/remote/`
