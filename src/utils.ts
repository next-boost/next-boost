import chalk from 'chalk'
import http from 'http'

type WriteFn = (chunk: string | Buffer, encoding?: BufferEncoding) => void

export function wrappedResponse(
  res: http.ServerResponse,
  cache: { [key: string]: any }
) {
  const chunks = []

  const push: WriteFn = (chunk, encoding) => {
    if (!chunk) return
    if (!Buffer.isBuffer(chunk)) chunk = Buffer.from(chunk, encoding)
    chunks.push(chunk)
  }

  return new Proxy(res, {
    get(target, p) {
      const orig = res[p]
      if (p === 'write' || p === 'end') {
        return <WriteFn>function (chunk, encoding) {
          push(chunk, encoding)
          if (p === 'end') {
            cache.body = Buffer.concat(chunks)
          }
          return orig.apply(target, [chunk, encoding])
        }
      } else {
        return orig
      }
    },
  })
}

export const shouldGzip = (header: string | string[]) => {
  return header && header.indexOf('gzip') !== -1
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
