import Cache from 'hybrid-disk-cache'
import { log } from './utils'

let interval: NodeJS.Timeout

export function initPurgeTimer(cache: Cache): void {
  if (interval) return
  const tbd = Math.min(cache.tbd, 3600)
  console.log('  Cache manager inited, will start to purge in %ds', tbd)
  interval = setInterval(() => {
    const start = process.hrtime()
    const rv = cache.purge()
    log(start, 'purge', `purged all ${rv} inactive record(s)`)
  }, tbd * 1000)
}

export function stopPurgeTimer(): void {
  clearInterval(interval)
}
