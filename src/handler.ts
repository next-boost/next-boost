import { IncomingMessage } from 'http'
import { gzipSync } from 'zlib'

import { lock, send, serveCache, unlock } from './cache-manager'
import { forMetrics, Metrics, serveMetrics } from './metrics'
import { encodePayload } from './payload'
import Renderer, { InitArgs } from './renderer'
import { CacheAdapter, HandlerConfig, WrappedHandler } from './types'
import { filterUrl, isZipped, log, mergeConfig, serve } from './utils'

function matchRules(conf: HandlerConfig, req: IncomingMessage) {
  const err = ['GET', 'HEAD'].indexOf(req.method ?? '') === -1
  if (err) return { matched: false, ttl: -1 }

  if (typeof conf.rules === 'function') {
    const ttl = conf.rules(req)
    if (ttl) return { matched: true, ttl }
  } else {
    for (const rule of conf.rules ?? []) {
      if (req.url && new RegExp(rule.regex).test(req.url)) {
        return { matched: true, ttl: rule.ttl }
      }
    }
  }
  return { matched: false, ttl: 0 }
}

/**
 * Wrap a http listener to serve cached response
 *
 * @param cache the cache
 * @param conf conf of next-boost
 * @param renderer the SSR renderer runs in worker thread
 * @param next pass-through handler
 *
 * @returns a request listener to use in http server
 */
const wrap: WrappedHandler = (cache, conf, renderer, next, metrics) => {
  return async (req, res) => {
    if (conf.metrics && forMetrics(req)) return serveMetrics(metrics, res)

    req.url = filterUrl(req.url ?? '', conf.paramFilter)
    const key = conf.cacheKey ? conf.cacheKey(req) : req.url
    const { matched, ttl } = matchRules(conf, req)
    if (!matched) {
      metrics.inc('bypass')
      res.setHeader('x-next-boost-status', 'bypass')
      return next(req, res)
    }

    const start = process.hrtime()
    const forced = req.headers['x-next-boost'] === 'update' // forced

    const state = await serveCache(cache, key, forced)
    res.setHeader('x-next-boost-status', state.status)
    metrics.inc(state.status)

    if (state.status === 'stale' || state.status === 'hit' || state.status === 'fulfill') {
      send(state.payload, res)
      if (!conf.quiet) log(start, state.status, req.url) // record time for stale and hit
      if (state.status !== 'stale') return // stop here
    } else if (state.status === 'timeout') {
      send({ body: null, headers: null }, res)
      return // prevent adding pressure to server
    }

    try {
      await lock(key, cache)

      const args = { path: req.url, headers: req.headers, method: req.method }
      const rv = await renderer.render(args)
      if (ttl > 0 && rv.statusCode === 200) rv.headers['cache-control'] = `public, max-age=${ttl}, must-revalidate`
      // rv.body is a Buffer in JSON format: { type: 'Buffer', data: [...] }
      const body = Buffer.from(rv.body)
      // stale has been served
      if (state.status !== 'stale') serve(res, rv)
      // when in stale, there will 2 log output. The latter is the rendering time on server
      if (!conf.quiet) log(start, state.status, req.url)
      if (rv.statusCode === 200) {
        // save gzipped data
        const payload = { headers: rv.headers, body: isZipped(rv.headers) ? body : gzipSync(body) }
        await cache.set('payload:' + key, encodePayload(payload), ttl)
      }
    } catch (e) {
      console.error('Error saving payload to cache', e)
    } finally {
      await unlock(key, cache)
    }
  }
}

export default async function CachedHandler(args: InitArgs, options?: HandlerConfig) {
  console.log('> Preparing cached handler')

  // merge config
  const conf = mergeConfig(options)

  // the cache
  if (!conf.cacheAdapter) {
    const { Adapter } = require('@next-boost/hybrid-disk-cache')
    conf.cacheAdapter = new Adapter() as CacheAdapter
  }
  const adapter = conf.cacheAdapter
  const cache = await adapter.init()

  const renderer = Renderer()
  await renderer.init(args)
  const plain = await require(args.script).default(args)

  const metrics = new Metrics()

  // init the child process for revalidate and cache purge
  return {
    handler: wrap(cache, conf, renderer, plain, metrics),
    cache,
    close: async () => {
      renderer.kill()
      await adapter.shutdown()
    },
  }
}
