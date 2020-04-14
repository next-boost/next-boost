import { ChildProcess } from 'child_process'
import http from 'http'
import { gzipSync } from 'zlib'
import Cache from './cache'
import Manager from './cache-manager'
import { CacheConfig } from './types'
import {
  isZipped,
  log,
  mergeConfig,
  serveCache,
  wrappedResponse,
} from './utils'

export default class CachedHandler {
  manager: ChildProcess
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
    this.manager.send({ action: 'init', payload: conf })

    this.handler = (req, res) => {
      const buf: { [key: string]: any } = {}
      let wrap = false
      const start = process.hrtime()

      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        req.headers['x-cache-status'] !== 'stale' // speical mark added by revalidate.ts
      ) {
        const status = this.cache.status('body:' + req.url)
        if (status !== 'miss') {
          if (status === 'stale') {
            this.manager.send({ action: 'revalidate', payload: req.url })
            log(start, 'stale', req.url)
          } else {
            log(start, 'hit', req.url)
          }
          serveCache(this.cache, req, res)
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
            ? 'update'
            : 'miss'
          : 'bypass'
        log(start, status, req.url)

        if (wrap && res.statusCode === 200 && buf.body) {
          // save gzipped data
          if (!isZipped(res)) buf.body = gzipSync(buf.body)
          this.cache.set('body:' + req.url, buf.body, ttl)
          this.cache.set('header:' + req.url, res.getHeaders(), ttl)
        }
        // This happens when browser send If-None-Match with etag
        // and the contents are identical. Server will return no body.
        // Here we use the revalidation process to cache the page later
        if (wrap && res.statusCode === 304) {
          this.manager.send({ action: 'revalidate', payload: req.url })
        }
      })

      handler(req, wrap ? wrappedResponse(res, buf) : res)
    }
  }

  close() {
    this.manager.kill()
  }
}
