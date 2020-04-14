const http = require('http')
const CachedHandler = require('../dist/handler').default

// a sluggish page
const handler = (_, res) =>
  setTimeout(() => res.end(new Date().toISOString()), 2000)
const port = 3000
const opts = { port, rules: [{ regex: '.*', ttl: 1 }] }
const cached = new CachedHandler(handler, opts)
const server = new http.Server(cached.handler)
server.listen(port, () => {
  console.log(`> Server on http://localhost:${port}`)
})
