import fs from 'fs'
import http, { ServerResponse } from 'http'
import Cache from 'hybrid-disk-cache'
import path from 'path'
import { PassThrough } from 'stream'
import { HandlerConfig } from './handler'
import { RenderResult } from './renderer'

function isZipped(headers: { [key: string]: any }): boolean {
  const field = headers['content-encoding']
  return typeof field === 'string' && field.includes('gzip')
}

function log(start: [number, number], status: string, msg?: string): void {
  const [secs, ns] = process.hrtime(start)
  const ms = ns / 1000000
  const timeS = `${secs > 0 ? secs + 's' : ''}`
  const timeMs = `${secs === 0 ? ms.toFixed(1) : ms.toFixed(0)}ms`
  const time = timeS + (secs > 1 ? '' : timeMs)
  console.log('%s | %s: %s', time.padStart(7), status.padEnd(6), msg)
}

const MAX_WAIT = 10000 // 10 seconds
const INTERVAL = 10 // 10 ms

async function serveCache(
  cache: Cache,
  lock: Set<string>,
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const start = process.hrtime()
  const err = ['GET', 'HEAD'].indexOf(req.method) === -1
  const force = req.headers['x-cache-status'] === 'update'
  let status = cache.has('body:' + req.url)
  // not-allowed-method or by-force or first-time miss
  if (err || force || (!lock.has(req.url) && status === 'miss')) return 'miss'

  // non first-time miss, wait for the cache
  if (status === 'miss') {
    let wait = 0
    while (lock.has(req.url)) {
      await sleep(INTERVAL)
      wait += INTERVAL
      // to protect the server from heavy payload
      if (wait > MAX_WAIT) {
        res.statusCode = 504
        res.end()
        return 'hit'
      }
    }
    status = 'hit'
  }

  const body = cache.get('body:' + req.url)
  const headers = JSON.parse(cache.get('header:' + req.url).toString())
  for (const k in headers) {
    res.setHeader(k, headers[k])
  }
  res.statusCode = 200

  res.removeHeader('content-length')
  res.setHeader('content-encoding', 'gzip')
  const stream = new PassThrough()
  stream.pipe(res)
  stream.end(body)

  log(start, status, req.url)

  // no need to run update again
  if (lock.has(req.url) && status === 'stale') status = 'hit'

  return status
}

function serve(res: ServerResponse, rv: RenderResult) {
  for (const k in rv.headers) res.setHeader(k, rv.headers[k])
  res.statusCode = rv.statusCode
  res.end(Buffer.from(rv.body))
}

function mergeConfig(c: HandlerConfig = {}) {
  const conf: HandlerConfig = {
    cache: { ttl: 60, tbd: 3600 },
    rules: [{ regex: '.*', ttl: 3600 }],
  }

  if (!c.filename) c.filename = '.next-boost.js'
  const configFile = path.resolve(c.filename)
  if (fs.existsSync(configFile)) {
    try {
      const f = require(configFile) as HandlerConfig
      c.cache = Object.assign(f.cache || {}, c.cache || {})
      c = Object.assign(f, c)
      console.log('  Loaded next-boost config from %s', c.filename)
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

export type ParamFilter = (param: string) => boolean

function filterUrl(url: string, filter?: ParamFilter) {
  if (!filter) return url

  const [p0, p1] = url.split('?', 2)
  const params = new URLSearchParams(p1)
  const keysToDelete = [...params.keys()].filter(k => !filter(k))
  for (const k of keysToDelete) params.delete(k)

  const qs = params.toString()
  return qs ? p0 + '?' + qs : p0
}

async function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export { isZipped, log, mergeConfig, serveCache, serve, filterUrl }
