// An example with custom cache adapter
const Adapter = require('@next-boost/redis-cache').Adapter

/** @type {import('@next-boost/next-boost/dist/types').HandlerConfig} */
module.exports = {
  rules: [],
  cacheAdapter: new Adapter({
    uri: 'redis://127.0.0.1:6379/1',
    ttl: 60,
    tbd: 3600,
  }),
}
