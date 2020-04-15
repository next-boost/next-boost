export interface URLCacheRule {
  regex: string
  ttl: number
}

export interface HandlerConfig {
  hostname?: string
  port?: number
  filename?: string
  quiet?: boolean
  cache?: {
    ttl?: number
    tbd?: number
    dbPath?: string
  }
  rules?: Array<URLCacheRule>
}

export interface CommandArg {
  action: string
  payload: any
}
