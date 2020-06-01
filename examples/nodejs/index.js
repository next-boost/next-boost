const http = require('http')
const CachedHandler = require('next-boost').default
const opts = { rules: [{ regex: '.*', ttl: 1 }] }
const script = require.resolve('./listener')

async function start() {
  const cached = await CachedHandler({ script }, opts)

  const server = new http.Server(cached.handler)
  server.listen(3000, () => {
    console.log(`> Server on http://localhost:3000`)
  })
}

start()
