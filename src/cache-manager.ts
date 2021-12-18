import { ServerResponse } from 'http'
import { PassThrough } from 'stream'

import { decodePayload } from './payload'
import { Cache, State } from './types'
import { sleep } from './utils'

const MAX_WAIT = 10000 // 10 seconds
const WAIT_INTERVAL = 10 // 10 ms

export async function hasLock(key: string, cache: Cache) {
  return (await cache.has('lock:' + key)) === 'hit'
}

// mutex lock to prevent same page rendered more than once
export async function lock(key: string, cache: Cache) {
  await cache.set('lock:' + key, Buffer.from('lock'), MAX_WAIT / 1000) // in seconds
}

export async function unlock(key: string, cache: Cache) {
  await cache.del('lock:' + key)
}

export async function serveCache(cache: Cache, key: string, forced: boolean): Promise<State> {
  if (forced) return { status: 'force' }

  try {
    const status = await cache.has('payload:' + key)
    if (status === 'hit') {
      const payload = decodePayload(await cache.get('payload:' + key))
      return { status: 'hit', payload }
    } else if (status === 'miss') {
      const lock = await hasLock(key, cache)
      // non first-time miss (the cache is being created), wait for the cache
      return !lock ? { status: 'miss' } : waitAndServe(key, cache)
    } else {
      // stale
      const payload = decodePayload(await cache.get('payload:' + key))
      return { status: 'stale', payload }
    }
  } catch (e) {
    console.error(`${key} cache error`, e)
    return { status: 'miss' }
  }
}

async function waitAndServe(key: string, cache: Cache): Promise<State> {
  while (await hasLock(key, cache)) {
    // lock will expire
    await sleep(WAIT_INTERVAL)
  }
  const status = await cache.has('payload:' + key)
  // still no cache after waiting for MAX_WAIT
  if (status === 'miss') {
    return { status: 'timeout' }
  } else {
    const payload = decodePayload(await cache.get('payload:' + key))
    return { status: 'fulfill', payload }
  }
}

export function send(
  payload: { body: Buffer | null; headers: Record<string, any> | null },
  res: ServerResponse,
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
