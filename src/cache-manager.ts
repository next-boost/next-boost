import Cache from 'hybrid-disk-cache'
import { Logger } from './logger'

let interval: NodeJS.Timeout

export function initPurgeTimer(cache: Cache, logger: Logger): void {
  if (interval) return
  const tbd = Math.min(cache.tbd, 3600)
  logger.logMessage('  Cache manager inited, will start to purge in %ds', tbd)
  interval = setInterval(() => {
    const start = process.hrtime()
    const rv = cache.purge()
    logger.logOperation(start, 'purge', `purged all ${rv} inactive record(s)`)
  }, tbd * 1000)
}

export function stopPurgeTimer(): void {
  clearInterval(interval)
}
