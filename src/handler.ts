import fs from 'fs'
import http from 'http'
import path from 'path'
import { Transform } from 'stream'
import { createGzip } from 'zlib'
import Cache from './cache'
import Manager from './cache-manager'
import { CacheConfig } from './types'
import { log, shouldGzip, wrappedResponse } from './utils'

function serveCache(
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
  const stream = new Transform()
  stream.push(body)
  stream.push(null)

  if (shouldGzip(req.headers['accept-encoding'])) {
    res.setHeader('content-encoding', 'gzip')
    stream.pipe(createGzip()).pipe(res)
  } else {
    stream.pipe(res)
  }
}

function mergeConfig(hostname: string, port: number) {
  const conf: CacheConfig = {
    hostname: hostname || 'localhost',
    port: port || 3000,
    cache: { dbPath: './.cache.db', ttl: 3600, tbd: 3600 },
    rules: [
      {
        regex: '.*',
        ttl: 3600,
      },
    ],
  }

  const configFile = path.resolve('.next-boost.js')
  if (fs.existsSync(configFile)) {
    try {
      const f = require(configFile) as CacheConfig
      if (f.cache) conf.cache = Object.assign(conf.cache, f.cache)
      if (f.rules) conf.rules = f.rules
      console.log('> Loaded next-boost config from .next-boost.js')
    } catch (error) {
      console.log(error)
      console.error('Failed to read next-boost config %s', configFile)
      process.exit(1)
    }
  }
  return conf
}

export function createCachedHandler(
  hostname: string,
  port: number,
  callback: (
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) => Promise<void>
) {
  const conf = mergeConfig(hostname, port)

  // the cache
  const cache = new Cache(conf.cache)
  console.log(`> Cache located at ${conf.cache.dbPath}`)

  // init the child process for revalidate and cache purge
  const manager = Manager()
  manager.send({ action: 'init', payload: conf })

  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const buf: { [key: string]: any } = {}
    let wrap = false
    const start = process.hrtime()

    if (
      (req.method === 'GET' || req.method === 'HEAD') &&
      req.headers['x-cache-status'] !== 'stale' // speical mark added by revalidate.ts
    ) {
      const status = cache.status('body:' + req.url)
      if (status !== 'miss') {
        if (status === 'stale') {
          manager.send({ action: 'revalidate', payload: req.url })
        }
        serveCache(cache, req, res)
        log(start, 'hit', req.url)
        return
      }
    }

    let ttl: number = null
    for (let rule of conf.rules) {
      if (new RegExp(rule.regex).test(req.url)) {
        wrap = true
        ttl = rule.ttl
        break
      }
    }

    await callback(req, wrap ? wrappedResponse(res, buf) : res)
    const status = wrap
      ? req.headers['x-cache-status'] === 'stale'
        ? 'rvl'
        : 'mis'
      : 'byp'
    log(start, status, req.url)

    res.on('close', () => {
      if (wrap && res.statusCode === 200) {
        cache.set('body:' + req.url, buf.body, ttl)
        cache.set('header:' + req.url, res.getHeaders(), ttl)
      }
      // This happens when browser send If-None-Match with etag
      // and the contents are identical. Server will return no body.
      // Here we use the revalidation process to cache the page later
      if (wrap && res.statusCode === 304) {
        manager.send({ action: 'revalidate', payload: req.url })
      }
    })
  }
}
