import http from 'http'
import Cache from 'hybrid-disk-cache'
import { gzipSync } from 'zlib'
import { initPurgeTimer, stopPurgeTimer } from './cache-manager'
import Renderer, { InitArgs } from './renderer'
import {
  filterUrl,
  isZipped,
  log,
  mergeConfig,
  ParamFilter,
  serve,
  serveCache,
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
  paramFilter?: ParamFilter
}

type RendererType = ReturnType<typeof Renderer>

type WrappedHandler = (
  cache: Cache,
  conf: HandlerConfig,
  renderer: RendererType,
  plainHandler: http.RequestListener
) => http.RequestListener

// mutex lock to prevent same page rendered more than once
const SYNC_LOCK = new Set<string>()

const wrap: WrappedHandler = (cache, conf, renderer, plainHandler) => {
  return async (req, res) => {
    req.url = filterUrl(req.url, conf.paramFilter)
    const { matched, ttl } = matchRule(conf, req.url)
    if (!matched) return plainHandler(req, res)

    const status = await serveCache(cache, SYNC_LOCK, req, res, conf.quiet)
    if (status === 'hit') return

    const start = process.hrtime()
    const rv = await renderer.render({
      path: req.url,
      headers: req.headers,
      method: req.method,
    })

    // rv.body is a Buffer in JSON format: { type: 'Buffer', data: [...] }
    const body = Buffer.from(rv.body)
    if (status === 'miss') serve(res, rv)

    const isUpdating = req.headers['x-cache-status'] === 'update'
    if (!conf.quiet) log(start, isUpdating ? 'reload' : status, req.url)

    if (rv.statusCode === 200 && body.length > 0) {
      // save gzipped data
      const buf = isZipped(rv.headers) ? body : gzipSync(body)
      cache.set('body:' + req.url, buf, ttl)
      cache.set('header:' + req.url, toBuffer(rv.headers), ttl)
    } else if (isUpdating) {
      // updating but get no result
      cache.del('body:' + req.url)
      cache.del('header:' + req.url)
    }
    SYNC_LOCK.delete(req.url)
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
