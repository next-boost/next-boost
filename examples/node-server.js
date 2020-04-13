const http = require('http')
const { createCachedHandler } = require('next-boost')

// a sluggish page
const handler = (req, res) => setTimeout(() => res.end('Mr. Slow'), 2000)
const port = 3000
const opts = { port }
const cached = createCachedHandler(handler, opts)
const server = new http.Server(cached)
server.listen(port, () => {
  console.log(`> Server on http://localhost:${port}`)
})
