import { IncomingMessage, ServerResponse } from 'http'

export async function serveMetrics(m: Metrics, res: ServerResponse) {
  res.setHeader('content-type', 'text/plain; version=0.0.4')
  Object.keys(m.data).forEach(k => {
    res.write(`next_boost_requests_total{status='${k}'} ${m.data[k]}\n`)
  })
  res.end()
}

export function forMetrics(req: IncomingMessage) {
  return req.url === '/__nextboost_metrics'
}

export class Metrics {
  data: Record<string, number> = {}

  inc(key: string) {
    return (this.data[key] = (this.data[key] || 0) + 1)
  }
}
