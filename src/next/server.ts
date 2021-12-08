#!/usr/bin/env node
process.env.NODE_ENV = 'production'

import http from 'http'
import stoppable from 'stoppable'

import { Argv, parse } from '../cli'
import CachedHandler from '../handler'

const serve = async (argv: Argv) => {
  const port = (argv['--port'] as number) || 3000
  // no host binding by default, the same as `next start`
  const hostname = argv['--hostname'] as string
  const quiet = argv['--quiet'] as boolean
  const dir = (argv['dir'] as string) || '.'
  const grace = (argv['--grace'] as number) || 5000

  const script = require.resolve('./init')
  const rendererArgs = { script, args: { dir, dev: false } }
  const cached = await CachedHandler(rendererArgs, { quiet })

  const server = stoppable(new http.Server(cached.handler), grace)
  server.listen(port, hostname, () => {
    console.log(`> Serving on http://${hostname || 'localhost'}:${port}`)
  })
  process.on('SIGTERM', () => {
    console.log('> Shutting down...')
    cached.close()
    server.stop((e, graceful) => {
      if (e) {
        console.error(e)
        process.exit(1)
      }
      if (graceful) {
        console.log('> Shutdown complete.')
      } else {
        console.log('> Force shutdown.')
      }
      process.exit(0)
    })
  })
}

if (require.main === module) {
  const argv = parse(process.argv)
  if (argv) serve(argv)
}
