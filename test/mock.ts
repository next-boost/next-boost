import { gzipSync } from 'zlib'
import { RequestListener } from '../src/renderer'

export default async function init(args: {
  [key: string]: any
}): Promise<RequestListener> {
  console.log('mock inited with %s', args)
  const cb: RequestListener = (req, res) => {
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
    res.end()
  }
  return cb
}
