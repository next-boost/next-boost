import http from 'http'
import Cache from 'hybrid-disk-cache'
import { gzipSync } from 'zlib'
import { initPurgeTimer, revalidate, stopPurgeTimer } from './cache-manager'
import { HandlerConfig } from './types'
import {
  isZipped,
  log,
  mergeConfig,
  serveCache,
  wrappedResponse,
} from './utils'

function matchRule(conf: HandlerConfig, url: string) {
  for (const rule of conf.rules) {
    if (url && new RegExp(rule.regex).test(url)) {
      return { matched: true, ttl: rule.ttl }
    }
  }
  return { matched: false, ttl: conf.cache.ttl }
}

function toBuffer(o: any) {
  return Buffer.from(JSON.stringify(o))
}

function wrap(
  cache: Cache,
  conf: HandlerConfig,
  handler: http.RequestListener
): http.RequestListener {
  return (req, res) => {
    const { matched, ttl } = matchRule(conf, req.url)
    if (!matched) return handler(req, res)

    const buf: { [key: string]: any } = {}
    const start = process.hrtime()

    const served = serveCache(cache, req, res)
    if (served === 'stale') revalidate(conf, req.url)
    if (served) return !conf.quiet && log(start, served, req.url)

    res.on('close', () => {
      const isUpdating = req.headers['x-cache-status'] === 'update'
      if (!conf.quiet) log(start, isUpdating ? 'update' : 'miss', req.url)

      if (res.statusCode === 200 && buf.body) {
        // save gzipped data
        if (!isZipped(res)) buf.body = gzipSync(buf.body)
        cache.set('body:' + req.url, buf.body, ttl)
        cache.set('header:' + req.url, toBuffer(res.getHeaders()), ttl)
      }
      // This happens when browser send If-None-Match with etag
      // and the contents are identical. Server will return no body.
      // Here we use the revalidation process to cache the page later
      if (res.statusCode === 304) {
        revalidate(conf, req.url)
      }
    })

    handler(req, wrappedResponse(res, buf))
  }
}

export default class CachedHandler {
  cache: Cache
  handler: http.RequestListener

  constructor(
    handler: (
      req: http.IncomingMessage,
      res: http.ServerResponse
    ) => Promise<void> | void,
    options?: HandlerConfig
  ) {
    const conf = mergeConfig(options)

    // the cache
    this.cache = new Cache(conf.cache)
    console.log(`> Cache located at ${this.cache.path}`)

    // purge timer
    initPurgeTimer(this.cache)

    // init the child process for revalidate and cache purge
    this.handler = wrap(this.cache, conf, handler)
  }

  close() {
    stopPurgeTimer()
  }
}
