// An example with default cache adapter: hybrid-disk-cache

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
}
