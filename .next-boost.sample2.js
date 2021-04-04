// An example with custom cache adapter
const HDCCache = require('next-boost-hdc-adapter').default

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
  cacheAdapter: HDCCache.init({
    path: '/tmp/hdc',
    ttl: 60,
    tbd: 3600,
  }),
}
