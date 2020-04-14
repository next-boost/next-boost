export interface URLCacheRule {
  regex: string
  ttl: number
}

export interface CacheConfig {
  hostname?: string
  port?: number
  filename?: string
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
