#!/usr/bin/env node

import serve from './server'

function help(argv?: string[]) {
  console.log(`
    Description
      Starts next.js application with stale-while-validate style cache.
      The application should be compiled with \`next build\` first.

    Usage
      $ next-boost <dir> -p <port>

    <dir> represents the directory of the Next.js application.
    If no directory is provided, the current directory will be used.

    Options
      --port, -p      A port number on which to start the application
      --hostname, -H  Hostname on which to start the application
      --help, -h      Displays this message
  `)
  if (require.main === module) {
    process.exit(0)
  }
  if (argv) {
    throw new Error(`Failed to parse arguments ${argv.join(' ')}`)
  }
}

export type Argv = { [key: string]: boolean | number | string }

export function parse(raw: string[]) {
  const types: { [key: string]: any } = {
    '--help': Boolean,
    '--port': Number,
    '--hostname': String,
  }
  const alias: { [key: string]: string } = {
    '-h': '--help',
    '-p': '--port',
    '-H': '--hostname',
  }

  raw = raw.slice(2)
  const argv: Argv = {}
  for (let i = 0; i < raw.length; i++) {
    let arg = raw[i]
    if (arg in alias) arg = alias[arg]
    const type = types[arg]
    if (!type) {
      if (!argv['dir']) {
        argv['dir'] = arg
        continue
      } else {
        return help(raw)
      }
    }
    if (type === Boolean) {
      argv[arg] = true
      continue
    }
    if (++i >= raw.length) return help(raw)
    const v = raw[i]
    if (type === Number) argv[arg] = parseInt(v, 10)
    else if (type === String) argv[arg] = v
  }

  if (argv['--help']) return help()

  return argv
}

if (require.main === module) {
  const argv = parse(process.argv)
  serve(argv || {})
}
