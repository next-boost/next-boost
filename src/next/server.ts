#!/usr/bin/env node
import http from 'http'
import { Argv, parse } from '../cli'
import { createCachedHandler } from '../handler'

const serve = async (argv: Argv) => {
  const port = (argv['--port'] as number) || 3000
  const hostname = (argv['--hostname'] as string) || 'localhost'
  const dir = (argv['dir'] as string) || '.'
  const app = require('next')({ dev: false, dir })
  const handler = app.getRequestHandler()
  const cached = createCachedHandler(handler, { hostname, port })

  await app.prepare()
  const server = new http.Server(cached)
  server.listen(port, hostname, () => {
    console.log(`> Server on http://${hostname}:${port}`)
  })
}

if (require.main === module) {
  const argv = parse(process.argv)
  if (argv) serve(argv)
}
