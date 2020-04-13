import SQLite3, { Database } from 'better-sqlite3'

const DDL = `
CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value BLOB, ttl REAL NOT NULL);
CREATE INDEX IF NOT EXISTS cache_valid_till ON cache (ttl);
`

type CacheStatus = 'hit' | 'stale' | 'miss'

interface CacheOptions {
  dbPath?: string
  ttl?: number
  tbd?: number
}

class Cache {
  db: Database
  ttl = 3600 // time to live
  tbd = 3600 // time before deletion

  constructor({ dbPath, ttl, tbd }: CacheOptions = {}) {
    const db = new SQLite3(dbPath || '/tmp/.cache.db')
    db.pragma('journal_mode = WAL')
    for (const s of DDL.trim().split('\n')) {
      db.prepare(s).run()
    }
    this.db = db
    if (ttl) this.ttl = ttl
    if (tbd) this.tbd = tbd
  }

  set = <T>(key: string, value: T, ttlSeconds?: number) => {
    if (!ttlSeconds) ttlSeconds = this.ttl

    const insert = this.db.prepare(
      'INSERT INTO cache (key, value, ttl) VALUES (@key, @value, @valid)' +
        ' ON CONFLICT(key)' +
        ' DO UPDATE SET value = @value, ttl = @valid'
    )

    insert.run({
      key,
      value: Buffer.isBuffer(value) ? value : JSON.stringify(value),
      valid: Math.floor(new Date().getTime() / 1000) + ttlSeconds,
    })
  }

  get = <T>(key: string, defaultValue?: T): T | undefined => {
    const rv = this.db.prepare('SELECT value FROM cache WHERE key = ?').get(key)
    if (!rv) return defaultValue
    return Buffer.isBuffer(rv.value) ? rv.value : (JSON.parse(rv.value) as T)
  }

  status = (key: string): CacheStatus => {
    const now = new Date().getTime() / 1000
    const rv = this.db.prepare('SELECT ttl FROM cache WHERE key = ?').get(key)
    return !rv ? 'miss' : rv.ttl > now ? 'hit' : 'stale'
  }

  del = (key: string) => {
    return this.db.prepare('DELETE FROM cache WHERE key = ?').run(key)
  }

  purge = () => {
    // ttl + tbd < now => ttl < now - tbd
    const now = new Date().getTime() / 1000 - this.tbd
    const rv = this.db.prepare('DELETE FROM cache WHERE ttl < ?').run(now)
    this.db.prepare('VACUUM').run()
    return rv
  }
}

export default Cache
