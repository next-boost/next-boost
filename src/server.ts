import { createServer } from 'http'
import { Argv } from './cli'
import { createCachedHandler } from './handler'

export default async (argv: Argv) => {
  const port = (argv['--port'] as number) || 3000
  const hostname = (argv['--hostname'] as string) || 'localhost'
  const dir = (argv['dir'] as string) || '.'
  const app = require('next')({ dev: false, dir })
  const handler = app.getRequestHandler()
  const cached = createCachedHandler(hostname, port, handler)

  createServer(async (req, res) => {
    await cached(req, res)
  }).listen(port, hostname, () => {
    console.log(`> Server on http://${hostname}:${port}`)
  })
}
