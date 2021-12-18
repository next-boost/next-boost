import { IncomingMessage, ServerResponse } from 'http'

import { Cache } from './types'

export const STATUSES = ['hit', 'stale', 'miss', 'timeout', 'fulfill', 'bypass', 'force']

async function stats(cache: Cache) {
  const keys = STATUSES.map(s => 'stats:' + s)
  const values = (await cache.count?.(keys)) || []
  return values.reduce((p, c, i) => {
    p[STATUSES[i]] = c
    return p
  }, {} as { [key: string]: number })
}

export async function serveStats(cache: Cache, res: ServerResponse) {
  const all = await stats(cache)
  res.setHeader('content-type', 'text/plain; version=0.0.4')
  Object.keys(all).forEach(k => {
    res.write(`next_boost_requests_total{status='${k}'} ${all[k]}\n`)
  })
  res.end()
}

export function isReqForStats(req: IncomingMessage) {
  return req.method === 'GET' && req.url === '/__nextboost_exporter'
}
