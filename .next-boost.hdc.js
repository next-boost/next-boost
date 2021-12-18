// An example with custom cache adapter
const Adapter = require('@next-boost/hybrid-disk-cache').Adapter

/** @type {import('@next-boost/next-boost/dist/types').HandlerConfig} */
module.exports = {
  rules: [
    {
      regex: '^/blog.*',
      ttl: 300,
    },
    {
      regex: '.*',
      ttl: 10,
    },
  ],
  paramFilter: p => {
    p === 'fbclid' || p.startsWith('utm_') ? false : true
  },
  cacheAdapter: new Adapter({
    path: '/tmp/hdc',
    ttl: 60,
    tbd: 3600,
  }),
}
