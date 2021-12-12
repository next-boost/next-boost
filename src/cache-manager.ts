import { ServerResponse } from 'http'
import { PassThrough } from 'stream'

import { CacheAdapter } from './handler'
import { sleep } from './utils'

const MAX_WAIT = 10000 // 10 seconds
const WAIT_INTERVAL = 10 // 10 ms

type HasReturn = ReturnType<CacheAdapter['has']> extends Promise<infer T>
  ? T
  : never

type ServeResult = {
  status: HasReturn | 'force' | 'error'
  stop: boolean
}

export async function hasLock(key: string, cache: CacheAdapter) {
  return (await cache.has('lock:' + key)) === 'hit'
}

// mutex lock to prevent same page rendered more than once
export async function addLock(key: string, cache: CacheAdapter) {
  await cache.set('lock:' + key, Buffer.from('lock'), MAX_WAIT / 1000) // in seconds
}

export async function delLock(key: string, cache: CacheAdapter) {
  await cache.del('lock:' + key)
}

export async function serveCache(
  cache: CacheAdapter,
  key: string,
  forced: boolean,
  res: ServerResponse
): Promise<ServeResult> {
  const rv: ServeResult = { status: 'force', stop: false }
  if (forced) return rv

  rv.status = await cache.has('body:' + key)
  // forced to skip cache or first-time miss
  let lock = await hasLock(key, cache)
  if (!lock && rv.status === 'miss') return rv

  // non first-time miss, wait for the cache
  if (rv.status === 'miss') await waitAndServe(key, cache, rv)

  const payload = { body: null, headers: null }
  if (!rv.stop) {
    payload.body = await cache.get('body:' + key)
    try {
      const header = await cache.get('header:' + key)
      payload.headers = JSON.parse(header?.toString())
    } catch {
      // bypass
    }
  }
  send(payload, res)

  // no need to run update again
  lock = await hasLock(key, cache)
  if ((lock && rv.status === 'stale') || rv.status === 'hit') {
    rv.stop = true
  }

  return rv
}

async function waitAndServe(key: string, cache: CacheAdapter, rv: ServeResult) {
  while (await hasLock(key, cache)) {
    // lock will expire
    await sleep(WAIT_INTERVAL)
  }
  rv.status = await cache.has('body:' + key)
  // still no cache after waiting for MAX_WAIT
  if (rv.status === 'miss') {
    rv.stop = true
    rv.status = 'error'
  }
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
