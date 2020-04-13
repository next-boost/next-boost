import chalk from 'chalk'
import fs from 'fs'
import http from 'http'
import path from 'path'
import { PassThrough } from 'stream'
import { createGunzip } from 'zlib'
import Cache from './cache'
import { BasicConfig, CacheConfig } from './types'

export function shouldZip(req: http.IncomingMessage): boolean {
  const field = req.headers['accept-encoding']
  return field !== undefined && field.indexOf('gzip') !== -1
}

export function isZipped(res: http.ServerResponse): boolean {
  const field = res.getHeader('content-encoding')
  if (typeof field === 'number') return false
  return field !== undefined && field.indexOf('gzip') !== -1
}

export function wrappedResponse(
  res: http.ServerResponse,
  cache: { [key: string]: unknown }
): http.ServerResponse {
  const chunks: Array<Buffer> = []

  const push = (...args: any[]) => {
    const [chunk, encoding] = args
    if (!chunk) return
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding))
  }

  const _end = res.end
  const _write = res.write

  res.write = (...args: any[]) => {
    push(...args)
    return _write.apply(res, args)
  }

  res.end = (...args: any[]) => {
    push(...args)
    cache.body = Buffer.concat(chunks)
    return _end.apply(res, args)
  }

  return res
}

export function serveCache(
  cache: Cache,
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const body = cache.get<Buffer>('body:' + req.url)
  const headers = cache.get<http.OutgoingHttpHeaders>('header:' + req.url)
  for (const k in headers) {
    res.setHeader(k, headers[k])
  }
  res.statusCode = 200
  const stream = new PassThrough()
  stream.end(body)

  res.removeHeader('content-length')
  if (shouldZip(req)) {
    res.setHeader('content-encoding', 'gzip')
    stream.pipe(res)
  } else {
    res.removeHeader('content-encoding')
    stream.pipe(createGunzip()).pipe(res)
  }
}

export function log(
  start: [number, number],
  status: string,
  msg?: string
): void {
  const [secs, ns] = process.hrtime(start)
  const ms = ns / 1000000

  let color = chalk.blue
  if (secs > 0) {
    color = chalk.red
  } else {
    if (ms > 100) color = chalk.yellow
    else color = chalk.green
  }

  let color2 = chalk.gray
  if (status === 'mis') color2 = chalk.yellow
  else if (status === 'rvl') color2 = chalk.blue
  else if (status === 'prg') color2 = chalk.red

  const time = `${secs > 0 ? secs + 's' : ''}${ms.toFixed(1)}ms`
  console.log(
    `%s | %s: %s`,
    color(time.padStart(7)),
    color2(status.padEnd(3)),
    msg
  )
}

export function mergeConfig(basic?: BasicConfig) {
  const conf: CacheConfig = {
    hostname: 'localhost',
    port: 3000,
    cache: { dbPath: './.cache.db', ttl: 3600, tbd: 3600 },
    rules: [
      {
        regex: '.*',
        ttl: 3600,
      },
    ],
  }
  Object.assign(conf, basic)

  if (!conf.filename) conf.filename = '.next-boost.js'
  const configFile = path.resolve(conf.filename)
  if (fs.existsSync(configFile)) {
    try {
      const f = require(configFile) as CacheConfig
      if (f.cache) conf.cache = Object.assign(conf.cache, f.cache)
      if (f.rules) conf.rules = f.rules
      console.log('> Loaded next-boost config from %s', conf.filename)
    } catch (error) {
      throw new Error(`Failed to load ${conf.filename}`)
    }
  }
  return conf
}
