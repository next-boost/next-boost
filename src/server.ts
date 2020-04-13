import http from 'http'
import { Argv } from './cli'
import { createCachedHandler } from './handler'

export default async (argv: Argv) => {
  const port = (argv['--port'] as number) || 3000
  const hostname = argv['--hostname'] as string
  const dir = (argv['dir'] as string) || '.'
  const app = require('next')({ dev: false, dir })
  const handler = app.getRequestHandler()
  const cached = createCachedHandler(handler, { hostname, port })

  await app.prepare()
  const server = new http.Server(cached)
  server.listen(port, hostname, () => {
    console.log(`> Server on http://${hostname || 'localhost'}:${port}`)
  })
}
