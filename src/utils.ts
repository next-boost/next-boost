import chalk from 'chalk'
import http from 'http'

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

export const shouldZip = (req: http.IncomingMessage): boolean => {
  const field = req.headers['accept-encoding']
  return field !== undefined && field.indexOf('gzip') !== -1
}

export const isZipped = (res: http.ServerResponse): boolean => {
  const field = res.getHeader('content-encoding')
  if (typeof field === 'number') return false
  return field !== undefined && field.indexOf('gzip') !== -1
}

export const log = (
  start: [number, number],
  status: string,
  msg?: string
): void => {
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
