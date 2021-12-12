#!/usr/bin/env node
process.env.NODE_ENV = 'production'

import http from 'http'
import gracefulShutdown from 'http-graceful-shutdown'

import { Argv, parse } from '../cli'
import CachedHandler from '../handler'

const serve = async (argv: Argv) => {
  const port = (argv['--port'] as number) || 3000
  // no host binding by default, the same as `next start`
  const hostname = argv['--hostname'] as string
  const quiet = argv['--quiet'] as boolean
  const dir = (argv['dir'] as string) || '.'
  const grace = (argv['--grace'] as number) || 30000

  const script = require.resolve('./init')
  const rendererArgs = { script, args: { dir, dev: false } }
  const cached = await CachedHandler(rendererArgs, { quiet })

  const server = new http.Server(cached.handler)
  server.listen(port, hostname, () => {
    console.log(`> Serving on http://${hostname || 'localhost'}:${port}`)
  })

  gracefulShutdown(server, {
    timeout: grace,
    preShutdown: async () => console.log('> Shutting down...'),
    onShutdown: async () => cached.close(),
    finally: () => console.log('> Shutdown complete.'),
  })
}

if (require.main === module) {
  const argv = parse(process.argv)
  if (argv) serve(argv)
}
