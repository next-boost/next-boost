#!/usr/bin/env node
import http from 'http'
import { Argv, parse } from '../cli'
import CachedHandler from '../handler'

const serve = async (argv: Argv) => {
  const port = (argv['--port'] as number) || 3000
  // no host binding by default, the same as `next start`
  const hostname = argv['--hostname'] as string
  const dir = (argv['dir'] as string) || '.'
  const app = require('next')({ dev: false, dir })
  const handler = app.getRequestHandler()
  const cached = new CachedHandler(handler, { hostname, port })

  await app.prepare()
  const server = new http.Server(cached.handler)
  server.listen(port, hostname, () => {
    console.log(`> Server on http://${hostname || 'localhost'}:${port}`)
  })
  process.on('SIGTERM', () => {
    console.log('> Shutting down...')
    cached.close()
    server.close()
  })
}

if (require.main === module) {
  const argv = parse(process.argv)
  if (argv) serve(argv)
}
