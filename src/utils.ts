import chalk from 'chalk'
import http from 'http'
import { PassThrough } from 'stream'
import { createGunzip } from 'zlib'
import Cache from './cache'

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
    const header = headers[k]
    if (header !== undefined) res.setHeader(k, header)
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
