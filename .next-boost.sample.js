// An example with default cache adapter: hybrid-disk-cache
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
  paramFilter: p => p !== 'fbclid' && !p.startsWith('utm_'),
}
