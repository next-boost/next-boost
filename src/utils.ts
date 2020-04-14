import cp from 'child_process'
import fs from 'fs'
import http from 'http'
import path from 'path'
import { PassThrough } from 'stream'
import { createGunzip } from 'zlib'
import Cache from './cache'
import { CacheConfig } from './types'

export function shouldZip(req: http.IncomingMessage): boolean {
  const field = req.headers['accept-encoding']
  return field !== undefined && field.indexOf('gzip') !== -1
}

export function isZipped(res: http.ServerResponse): boolean {
  const field = res.getHeader('content-encoding')
  if (typeof field === 'number') return false
  return field !== undefined && field.indexOf('gzip') !== -1
}

export function wrappedResponse(
  res: http.ServerResponse,
  cache: { [key: string]: unknown }
): http.ServerResponse {
  const chunks: Array<Buffer> = []

  const push = (...args: any[]) => {
    const [chunk, encoding] = args
    if (!chunk) return
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding))
  }

  const _end = res.end
  const _write = res.write

  res.write = (...args: any[]) => {
    push(...args)
    return _write.apply(res, args)
  }

  res.end = (...args: any[]) => {
    push(...args)
    cache.body = Buffer.concat(chunks)
    return _end.apply(res, args)
  }

  return res
}

export function serveCache(
  cache: Cache,
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const body = cache.get<Buffer>('body:' + req.url)
  const headers = cache.get<http.OutgoingHttpHeaders>('header:' + req.url)
  for (const k in headers) {
    res.setHeader(k, headers[k])
  }
  res.statusCode = 200
  const stream = new PassThrough()
  stream.end(body)

  res.removeHeader('content-length')
  if (shouldZip(req)) {
    res.setHeader('content-encoding', 'gzip')
    stream.pipe(res)
  } else {
    res.removeHeader('content-encoding')
    stream.pipe(createGunzip()).pipe(res)
  }
}

export function log(
  start: [number, number],
  status: string,
  msg?: string
): void {
  const [secs, ns] = process.hrtime(start)
  const ms = ns / 1000000
  const time = `${secs > 0 ? secs + 's' : ''}${ms.toFixed(1)}ms`
  console.log('%s | %s: %s', time.padStart(7), status.padEnd(6), msg)
}

export function mergeConfig(c: CacheConfig = {}) {
  const conf: CacheConfig = {
    hostname: 'localhost',
    port: 3000,
    cache: { dbPath: './.cache.db', ttl: 3600, tbd: 3600 },
    rules: [
      {
        regex: '.*',
        ttl: 3600,
      },
    ],
  }

  if (!c.filename) c.filename = '.next-boost.js'
  const configFile = path.resolve(c.filename)
  if (fs.existsSync(configFile)) {
    try {
      const f = require(configFile) as CacheConfig
      c.cache = Object.assign(f.cache || {}, c.cache || {})
      c = Object.assign(f, c)
      console.log('> Loaded next-boost config from %s', c.filename)
    } catch (error) {
      throw new Error(`Failed to load ${c.filename}`)
    }
  }

  // deep merge cache and remove it
  Object.assign(conf.cache, c.cache)
  delete c.cache
  Object.assign(conf, c)

  return conf
}

export function fork(modulePath: string) {
  const isTest = process.env.NODE_ENV === 'test'
  const options = isTest ? { execArgv: ['-r', 'ts-node/register'] } : null
  return cp.fork(modulePath, [], options)
}
