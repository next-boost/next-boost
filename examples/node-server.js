const http = require('http')
const CachedHandler = require('../dist/handler')

// a sluggish page
const handler = (req, res) => setTimeout(() => res.end('Mr. Slow'), 2000)
const port = 3000
const opts = { port }
const cached = new CachedHandler(handler, opts)
const server = new http.Server(cached.handler)
server.listen(port, () => {
  console.log(`> Server on http://localhost:${port}`)
})
