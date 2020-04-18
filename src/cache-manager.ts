import http from 'http'
import Cache from 'hybrid-disk-cache'
import { HandlerConfig } from './types'
import { log } from './utils'

// prevent same url being revalidated multiple times
const queue = new Set<string>()
let interval: NodeJS.Timeout

export function revalidate(conf: HandlerConfig, uri: string) {
  const url = `http://${conf.hostname || 'localhost'}:${conf.port}` + uri
  if (queue.has(url)) return

  queue.add(url)

  // in the next loop
  setImmediate(() => {
    http.get(url, { headers: { 'x-cache-status': 'update' } }, () => {
      queue.delete(url)
    })
  })
}

export function initPurgeTimer(cache: Cache) {
  if (interval) return
  // const cache = new Cache(conf.cache)
  const tbd = Math.min(cache.tbd, 3600)
  console.log('> Cache manager inited, will start to purge in %ds', tbd)
  interval = setInterval(() => {
    const start = process.hrtime()
    const rv = cache.purge()
    log(start, 'prg', `purged all ${rv} inactive record(s)`)
  }, tbd * 1000)
}

export function stopPurgeTimer() {
  clearInterval(interval)
}
