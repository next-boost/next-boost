import { ServerResponse } from 'http'
import Cache from 'hybrid-disk-cache'
import { PassThrough } from 'stream'
import { log, sleep } from './utils'

let interval: NodeJS.Timeout

const MAX_WAIT = 10000 // 10 seconds
const INTERVAL = 10 // 10 ms

type ServeResult = {
  status: ReturnType<Cache['has']> | 'force' | 'error'
  stop: boolean
}

export function initPurgeTimer(cache: Cache): void {
  if (interval) return
  const tbd = Math.min(cache.tbd, 3600)
  console.log('  Cache manager inited, will start to purge in %ds', tbd)
  interval = setInterval(() => {
    const start = process.hrtime()
    const rv = cache.purge()
    log(start, 'purge', `purged all ${rv} inactive record(s)`)
  }, tbd * 1000)
}

export function stopPurgeTimer(): void {
  clearInterval(interval)
}

export async function serveCache(
  cache: Cache,
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
