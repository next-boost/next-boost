import { ServerResponse } from 'http'
import { PassThrough } from 'stream'
import { CacheAdapter } from './handler'
import { sleep } from './utils'

const MAX_WAIT = 10000 // 10 seconds
const INTERVAL = 10 // 10 ms

type ServeResult = {
  status: ReturnType<CacheAdapter['has']> | 'force' | 'error'
  stop: boolean
}

export async function serveCache(
  cache: CacheAdapter,
  lock: Set<string>,
  key: string,
  forced: boolean,
  res: ServerResponse
): Promise<ServeResult> {
  const rv: ServeResult = { status: 'force', stop: false }
  if (forced) return rv

  rv.status = cache.has('body:' + key)
  // forced to skip cache or first-time miss
  if (!lock.has(key) && rv.status === 'miss') return rv

  // non first-time miss, wait for the cache
  if (rv.status === 'miss') await waitAndServe(() => lock.has(key), rv)

  const payload = { body: null, headers: null }
  if (!rv.stop) {
    payload.body = cache.get('body:' + key)
    payload.headers = JSON.parse(cache.get('header:' + key).toString())
  }
  send(payload, res)

  // no need to run update again
  if ((lock.has(key) && rv.status === 'stale') || rv.status === 'hit') {
    rv.stop = true
  }

  return rv
}

async function waitAndServe(hasLock: () => boolean, rv: ServeResult) {
  const start = new Date().getTime()
  while (hasLock()) {
    await sleep(INTERVAL)
    const now = new Date().getTime()
    // to protect the server from heavy payload
    if (now - start > MAX_WAIT) {
      rv.stop = true
      rv.status = 'error'
      return
    }
  }
  rv.status = 'hit'
}

function send(
  payload: { body: Buffer | null; headers: Record<string, any> | null },
  res: ServerResponse
) {
  const { body, headers } = payload
  if (!body) {
    res.statusCode = 504
    return res.end()
  }
  for (const k in headers) {
    res.setHeader(k, headers[k])
  }
  res.statusCode = 200
  res.removeHeader('transfer-encoding')
  res.setHeader('content-length', Buffer.byteLength(body))
  res.setHeader('content-encoding', 'gzip')
  const stream = new PassThrough()
  stream.pipe(res)
  stream.end(body)
}
