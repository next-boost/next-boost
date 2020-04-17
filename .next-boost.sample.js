module.exports = {
  cache: {
    path: '/tmp/jinja',
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
