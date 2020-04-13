#!/usr/bin/env node
import { parse } from './cli'
import serve from './server'

if (require.main === module) {
  const argv = parse(process.argv)
  if (argv) serve(argv)
}
