import fs from 'fs'
import http from 'http'
import path from 'path'
import { gzipSync } from 'zlib'
import Cache from './cache'
import Manager from './cache-manager'
import { CacheConfig } from './types'
import { isZipped, log, serveCache, wrappedResponse } from './utils'

function mergeConfig(hostname?: string, port?: number) {
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
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) => Promise<void>,
  options?: {
    hostname?: string
    port?: number
  }
): http.RequestListener {
  const conf = mergeConfig(options?.hostname, options?.port)

  // the cache
  const cache = new Cache(conf.cache)
  console.log(`> Cache located at ${conf.cache.dbPath}`)

  // init the child process for revalidate and cache purge
  const manager = Manager()
  manager.send({ action: 'init', payload: conf })

  return async function (req, res) {
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

    let ttl: number
    for (const rule of conf.rules || []) {
      if (req.url && new RegExp(rule.regex).test(req.url)) {
        wrap = true
        ttl = rule.ttl
        break
      }
    }

    await handler(req, wrap ? wrappedResponse(res, buf) : res)
    const status = wrap
      ? req.headers['x-cache-status'] === 'stale'
        ? 'rvl'
        : 'mis'
      : 'byp'
    log(start, status, req.url)

    res.on('close', () => {
      if (wrap && res.statusCode === 200) {
        // save gzipped data
        if (!isZipped(res)) buf.body = gzipSync(buf.body)
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
