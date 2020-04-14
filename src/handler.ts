import http from 'http'
import { gzipSync } from 'zlib'
import Cache from './cache'
import Manager, { CacheManager } from './cache-manager'
import { CacheConfig } from './types'
import {
  isZipped,
  log,
  mergeConfig,
  serveCache,
  wrappedResponse,
} from './utils'

function matchRule(conf: CacheConfig, url: string) {
  for (const rule of conf.rules) {
    if (url && new RegExp(rule.regex).test(url)) {
      return { matched: true, ttl: rule.ttl }
    }
  }
  return { matched: false, ttl: conf.cache.ttl }
}

function wrap(
  manager: CacheManager,
  cache: Cache,
  conf: CacheConfig,
  handler: http.RequestListener
): http.RequestListener {
  return (req, res) => {
    const buf: { [key: string]: any } = {}
    const start = process.hrtime()

    const served = serveCache(cache, req, res)
    if (served === 'stale') manager.revalidate(req.url)
    if (served) return

    const { matched, ttl } = matchRule(conf, req.url)

    res.on('close', () => {
      const status = matched
        ? req.headers['x-cache-status'] === 'stale'
          ? 'update'
          : 'miss'
        : 'bypass'
      log(start, status, req.url)

      if (matched && res.statusCode === 200 && buf.body) {
        // save gzipped data
        if (!isZipped(res)) buf.body = gzipSync(buf.body)
        cache.set('body:' + req.url, buf.body, ttl)
        cache.set('header:' + req.url, res.getHeaders(), ttl)
      }
      // This happens when browser send If-None-Match with etag
      // and the contents are identical. Server will return no body.
      // Here we use the revalidation process to cache the page later
      if (matched && res.statusCode === 304) {
        manager.revalidate(req.url)
      }
    })

    handler(req, matched ? wrappedResponse(res, buf) : res)
  }
}

export default class CachedHandler {
  manager: CacheManager
  cache: Cache
  handler: http.RequestListener

  constructor(
    handler: (
      req: http.IncomingMessage,
      res: http.ServerResponse
    ) => Promise<void> | void,
    options?: CacheConfig
  ) {
    const conf = mergeConfig(options)

    // the cache
    this.cache = new Cache(conf.cache)
    console.log(`> Cache located at ${conf.cache.dbPath}`)

    // init the child process for revalidate and cache purge
    this.manager = Manager()
    this.manager.init(conf)
    this.handler = wrap(this.manager, this.cache, conf, handler)
  }

  close() {
    this.manager.kill()
  }
}
