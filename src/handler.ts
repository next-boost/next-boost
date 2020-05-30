import http from 'http'
import Cache from 'hybrid-disk-cache'
import { gzipSync } from 'zlib'
import { initPurgeTimer, stopPurgeTimer } from './cache-manager'
import Renderer from './renderer'
import { isZipped, log, mergeConfig, serveCache } from './utils'

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

interface URLCacheRule {
  regex: string
  ttl: number
}

export interface HandlerConfig {
  filename?: string
  quiet?: boolean
  cache?: {
    ttl?: number
    tbd?: number
    path?: string
  }
  rules?: Array<URLCacheRule>
}

function wrap(
  cache: Cache,
  conf: HandlerConfig,
  renderer: Renderer
): http.RequestListener {
  return (req, res) => {
    const { matched, ttl } = matchRule(conf, req.url)
    if (!matched) return renderer.handler(req, res)

    const start = process.hrtime()
    const served = serveCache(cache, req, res)
    if (served === 'hit') return !conf.quiet && log(start, served, req.url)

    // send task to render in child process
    renderer.render(req, (statusCode, headers, body) => {
      const status = req.headers['x-cache-status']
      const isUpdating = status === 'update' || served === 'stale'
      if (!conf.quiet) log(start, isUpdating ? 'update' : 'miss', req.url)

      if (statusCode === 200 && body.length > 0) {
        // save gzipped data
        const buf = isZipped(headers) ? Buffer.from(body) : gzipSync(body)
        cache.set('body:' + req.url, buf, ttl)
        cache.set('header:' + req.url, toBuffer(headers), ttl)
      } else if (isUpdating) {
        // updating but get no result
        cache.del('body:' + req.url)
        cache.del('header:' + req.url)
      }

      if (!served) {
        for (const k in headers) res.setHeader(k, headers[k])
        res.statusCode = statusCode
        res.end(body)
      }
    })
  }
}

export default class CachedHandler {
  cache: Cache
  handler: http.RequestListener
  private renderer: Renderer

  constructor(renderer: Renderer, options?: HandlerConfig) {
    console.log('> Preparing cached handler')

    // merge config
    const conf = mergeConfig(options)

    // the cache
    this.cache = new Cache(conf.cache)
    console.log(`  Cache located at ${this.cache.path}`)

    // purge timer
    initPurgeTimer(this.cache)

    // init the child process for revalidate and cache purge
    this.handler = wrap(this.cache, conf, renderer)

    this.renderer = renderer
  }

  close(): void {
    stopPurgeTimer()
    this.renderer.stop()
  }
}
