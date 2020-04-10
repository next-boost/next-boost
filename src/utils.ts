import chalk from 'chalk'
import http, { IncomingMessage, ServerResponse } from 'http'

export function wrappedResponse(
  res: http.ServerResponse,
  cache: { [key: string]: any }
) {
  const chunks = []

  const push = (...args: any[]) => {
    let [chunk, encoding] = args
    if (!chunk) return
    if (!Buffer.isBuffer(chunk)) chunk = Buffer.from(chunk, encoding)
    chunks.push(chunk)
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

export const shouldZip = (req: IncomingMessage) => {
  const field = req.headers['accept-encoding']
  return field && field.indexOf('gzip') !== -1
}

export const isZipped = (res: ServerResponse) => {
  const field = res.getHeader('content-encoding')
  if (typeof field === 'number') return false
  return field && field.indexOf('gzip') !== -1
}

export const log = (start: [number, number], status: string, msg: string) => {
  let [time0, time1] = process.hrtime(start)
  time1 = time1 / 1000000

  let color = chalk.blue
  if (time0 > 0) color = chalk.red
  else if (time1 > 100) color = chalk.yellow
  else if (time1 < 10) color = chalk.green

  let color2 = chalk.gray
  if (status === 'mis') color2 = chalk.yellow
  else if (status === 'rvl') color2 = chalk.blue
  else if (status === 'prg') color2 = chalk.red

  const time = `${time0 > 0 ? time0 + 's' : ''}${time1.toFixed(1)}ms`
  console.log(
    `%s | %s: %s`,
    color(time.padStart(7)),
    color2(status.padEnd(3)),
    msg
  )
}
