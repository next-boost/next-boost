import { IncomingMessage, RequestListener } from 'http'
import Cache from 'next-boost-hdc-adapter'
import { gzipSync } from 'zlib'
import { serveCache } from './cache-manager'
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
  return { matched: false, ttl: 0 }
}

function toBuffer(o: any) {
  return Buffer.from(JSON.stringify(o))
}

interface URLCacheRule {
  regex: string
  ttl: number
}

export type CacheKeyBuilder = (req: IncomingMessage) => string

export type CacheStatus = 'hit' | 'stale' | 'miss'

export type CacheAdapter = {
  set(key: string, value: Buffer, ttl?: number): Promise<void>
  get(key: string, defaultValue?: Buffer): Promise<Buffer | undefined>
  has(key: string): Promise<CacheStatus>
  del(key: string): Promise<void>
}

export interface HandlerConfig {
  filename?: string // config file's path
  quiet?: boolean
  rules?: Array<URLCacheRule>
  cacheAdapter?: CacheAdapter
  paramFilter?: ParamFilter
  cacheKey?: CacheKeyBuilder
}

type RendererType = ReturnType<typeof Renderer>

type WrappedHandler = (
  cache: CacheAdapter,
  conf: HandlerConfig,
  renderer: RendererType,
  plainHandler: RequestListener
) => RequestListener

// mutex lock to prevent same page rendered more than once
const SYNC_LOCK = new Set<string>()

const wrap: WrappedHandler = (cache, conf, renderer, plainHandler) => {
  return async (req, res) => {
    req.url = filterUrl(req.url, conf.paramFilter)
    const key = conf.cacheKey ? conf.cacheKey(req) : req.url
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
      await cache.set('body:' + key, buf, ttl)
      await cache.set('header:' + key, toBuffer(rv.headers), ttl)
    } else if (status === 'force') {
      // updating but empty result
      await cache.del('body:' + key)
      await cache.del('header:' + key)
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
  const cache = conf.cacheAdapter || Cache.init()

  const renderer = Renderer()
  await renderer.init(args)
  const plain = await require(args.script).default(args)

  // init the child process for revalidate and cache purge
  return {
    handler: wrap(cache, conf, renderer, plain),
    cache,
    close: () => {
      Cache.shutdown()
      renderer.kill()
    },
  }
}
