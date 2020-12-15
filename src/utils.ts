import fs from 'fs'
import { ServerResponse } from 'http'
import path from 'path'
import { HandlerConfig } from './handler'
import { RenderResult } from './renderer'

function isZipped(headers: { [key: string]: any }): boolean {
  const field = headers['content-encoding']
  return typeof field === 'string' && field.includes('gzip')
}

function log(start: [number, number], status: string, msg?: string): void {
  const [secs, ns] = process.hrtime(start)
  const ms = ns / 1000000
  const timeS = `${secs > 0 ? secs + 's' : ''}`
  const timeMs = `${secs === 0 ? ms.toFixed(1) : ms.toFixed(0)}ms`
  const time = timeS + (secs > 1 ? '' : timeMs)
  console.log('%s | %s: %s', time.padStart(7), status.padEnd(6), msg)
}

function serve(res: ServerResponse, rv: RenderResult) {
  for (const k in rv.headers) res.setHeader(k, rv.headers[k])
  res.statusCode = rv.statusCode
  res.end(Buffer.from(rv.body))
}

function mergeConfig(c: HandlerConfig = {}) {
  const conf: HandlerConfig = {
    cache: { ttl: 60, tbd: 3600 },
    rules: [{ regex: '.*', ttl: 3600 }],
  }

  if (!c.filename) c.filename = '.next-boost.js'
  const configFile = path.resolve(c.filename)
  if (fs.existsSync(configFile)) {
    try {
      const f = require(configFile) as HandlerConfig
      c.cache = Object.assign(f.cache || {}, c.cache || {})
      c.quiet = c.quiet || f.quiet
      c = Object.assign(f, c)
      console.log('  Loaded next-boost config from %s', c.filename)
    } catch (error) {
      throw new Error(`Failed to load ${c.filename}`)
    }
  }

  // deep merge cache and remove it
  Object.assign(conf.cache, c.cache)
  delete c.cache
  Object.assign(conf, c)

  return conf
}

export type ParamFilter = (param: string) => boolean

function filterUrl(url: string, filter?: ParamFilter) {
  if (!filter) return url

  const [p0, p1] = url.split('?', 2)
  const params = new URLSearchParams(p1)
  const keysToDelete = [...params.keys()].filter(k => !filter(k))
  for (const k of keysToDelete) params.delete(k)

  const qs = params.toString()
  return qs ? p0 + '?' + qs : p0
}

async function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export { isZipped, log, mergeConfig, sleep, serve, filterUrl }
