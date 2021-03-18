import { gzipSync } from 'zlib'
import { RequestListener } from '../src/renderer'

export default async function init(): Promise<RequestListener> {
  const cb: RequestListener = (req, res) => {
    if (req.url.startsWith('/params')) {
      res.write('params')
    }
    if (req.url === '/hello') {
      res.write('hello')
    } else if (req.url === '/hello-zip') {
      res.setHeader('content-encoding', 'gzip')
      res.write(gzipSync(Buffer.from('hello')))
    } else if (req.url === '/hello-304') {
      res.statusCode = 304
    } else if (req.url === '/hello-empty') {
      res.write('')
    } else {
      res.statusCode = 404
    }
    if (!req.url.startsWith('/slow-')) {
      res.end()
    } else {
      const time = req.url.replace(/\/slow-(\d+)$/, '$1')
      console.log(`slow with ${time}ms`)
      setTimeout(() => {
        res.statusCode = 200
        res.write(`slow with ${time}ms done!`)
        res.end()
      }, parseInt(time, 10) || 100)
    }
  }
  return cb
}
