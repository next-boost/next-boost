module.exports = {
  cache: {
    dbPath: '/tmp/jinja.cache.db',
    ttl: 60,
    tbd: 3600,
  },
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
}
