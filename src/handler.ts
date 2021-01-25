import { IncomingMessage, RequestListener } from 'http'
import Cache from 'hybrid-disk-cache'
import { gzipSync } from 'zlib'
import { initPurgeTimer, serveCache, stopPurgeTimer } from './cache-manager'
import Renderer, { InitArgs } from './renderer'
import {
  filterUrl,
  isZipped,
  log,
  mergeConfig,
  ParamFilter,
  serve,
} from './utils'

function matchRule(conf: HandlerConfig, req: IncomingMessage) {
  const err = ['GET', 'HEAD'].indexOf(req.method) === -1
  if (err) return { matched: false, ttl: -1 }
  for (const rule of conf.rules) {
    if (req.url && new RegExp(rule.regex).test(req.url)) {
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

export type CacheKeyBuilder = (req: IncomingMessage) => string

export interface HandlerConfig {
  filename?: string
  quiet?: boolean
  cache?: {
    ttl?: number
    tbd?: number
    path?: string
  }
  rules?: Array<URLCacheRule>
  paramFilter?: ParamFilter
  cacheKey?: CacheKeyBuilder
}

type RendererType = ReturnType<typeof Renderer>

type WrappedHandler = (
  cache: Cache,
  conf: HandlerConfig,
  renderer: RendererType,
  plainHandler: RequestListener
) => RequestListener

// mutex lock to prevent same page rendered more than once
const SYNC_LOCK = new Set<string>()

const wrap: WrappedHandler = (cache, conf, renderer, plainHandler) => {
  return async (req, res) => {
    const key = conf.cacheKey ? conf.cacheKey(req) : req.url
    req.url = filterUrl(req.url, conf.paramFilter)
    const { matched, ttl } = matchRule(conf, req)
    if (!matched) return plainHandler(req, res)

    const start = process.hrtime()
    const fc = req.headers['x-cache-status'] === 'update' // forced

    const { status, stop } = await serveCache(cache, SYNC_LOCK, key, fc, res)
    if (stop) return !conf.quiet && log(start, status, req.url)
    // log the time took for staled
    if (status === 'stale') !conf.quiet && log(start, status, req.url)

    SYNC_LOCK.add(key)

    const args = { path: req.url, headers: req.headers, method: req.method }
    const rv = await renderer.render(args)

    // rv.body is a Buffer in JSON format: { type: 'Buffer', data: [...] }
    const body = Buffer.from(rv.body)
    // stale means already served from cache with old ver, just update the cache
    if (status !== 'stale') serve(res, rv)
    // stale will print 2 lines, first 'stale', second 'update'
    !conf.quiet && log(start, status === 'stale' ? 'update' : status, req.url)

    if (rv.statusCode === 200 && body.length > 0) {
      // save gzipped data
      const buf = isZipped(rv.headers) ? body : gzipSync(body)
      cache.set('body:' + key, buf, ttl)
      cache.set('header:' + key, toBuffer(rv.headers), ttl)
    } else if (status === 'force') {
      // updating but empty result
      cache.del('body:' + key)
      cache.del('header:' + key)
    }

    SYNC_LOCK.delete(key)
  }
}

export default async function CachedHandler(
  args: InitArgs,
  options?: HandlerConfig
) {
  console.log('> Preparing cached handler')

  // merge config
  const conf = mergeConfig(options)

  // the cache
  const cache = new Cache(conf.cache)
  console.log(`  Cache located at ${cache.path}`)

  // purge timer
  initPurgeTimer(cache)

  const renderer = Renderer()
  await renderer.init(args)
  const plain = await require(args.script).default(args)

  // init the child process for revalidate and cache purge
  return {
    handler: wrap(cache, conf, renderer, plain),
    cache,
    close: () => {
      stopPurgeTimer()
      renderer.kill()
    },
  }
}
