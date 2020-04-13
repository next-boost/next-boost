export interface URLCacheRule {
  regex: string
  ttl: number
}

export interface CacheConfig extends BasicConfig {
  cache: {
    ttl?: number
    tbd?: number
    dbPath?: string
  }
  rules?: Array<URLCacheRule>
}

interface BasicConfig {
  hostname?: string
  port?: number
  filename?: string
}

export interface CommandArg {
  action: string
  payload: any
}
