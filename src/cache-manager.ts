import { fork } from 'child_process'
import { clearInterval } from 'timers'
import Cache from './cache'
import { CacheConfig, CommandArg } from './types'
import { log } from './utils'
import http from 'http'

// prevent same url being revalidated multiple times
const queue = new Set<string>()
let interval: NodeJS.Timeout
let conf: CacheConfig

function revalidate(uri: string) {
  const url = `http://${conf.hostname}:${conf.port}` + uri
  if (queue.has(url)) return

  queue.add(url)
  http.get(url, { headers: { 'x-cache-status': 'stale' } }, () => {
    queue.delete(url)
  })
}

function initPurge() {
  if (interval) return
  const cache = new Cache(conf.cache)
  console.log(
    '> Cache manager inited, will start to purge in %ds',
    conf.cache.tbd
  )
  interval = setInterval(() => {
    const start = process.hrtime()
    const rv = cache.purge()
    log(start, 'prg', `purged and vacuum all ${rv.changes} inactive cache`)
  }, conf.cache.tbd * 1000)
}

process.on('message', (cmd: CommandArg) => {
  if (cmd.action === 'revalidate') {
    revalidate(cmd.payload)
  } else if (cmd.action === 'init') {
    conf = cmd.payload
    initPurge()
  }
})

process.on('beforeExit', () => {
  clearInterval(interval)
})

export default () => fork(__filename)
