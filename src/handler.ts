import http from 'http'
import { gzipSync } from 'zlib'
import Cache from './cache'
import Manager from './cache-manager'
import { BasicConfig } from './types'
import {
  isZipped,
  log,
  mergeConfig,
  serveCache,
  wrappedResponse,
} from './utils'

export function createCachedHandler(
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) => Promise<void>,
  options?: BasicConfig
): http.RequestListener {
  const conf = mergeConfig(options)

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

    res.on('close', () => {
      const status = wrap
        ? req.headers['x-cache-status'] === 'stale'
          ? 'rvl'
          : 'mis'
        : 'byp'
      log(start, status, req.url)

      if (wrap && res.statusCode === 200 && buf.body) {
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

    await handler(req, wrap ? wrappedResponse(res, buf) : res)
  }
}
