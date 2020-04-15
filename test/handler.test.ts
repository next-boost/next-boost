import { expect } from 'chai'
import http from 'http'
import request from 'supertest'
import { gzipSync } from 'zlib'
import CachedHandler from '../src/handler'

const handler: http.RequestListener = (req, res) => {
  if (req.url === '/hello') {
    res.write('hello')
  } else if (req.url === '/hello-zip') {
    res.setHeader('content-encoding', 'gzip')
    res.write(gzipSync(Buffer.from('hello')))
  } else if (req.url === '/hello-304') {
    res.statusCode = 304
  } else {
    res.statusCode = 404
  }
  res.end()
}

describe('cached handler', () => {
  let cached: CachedHandler
  let server: http.Server

  before((done) => {
    const port = 3001
    cached = new CachedHandler(handler, {
      port,
      rules: [{ regex: '/hello.*', ttl: 0.5 }],
    })
    cached.cache.del('body:/hello')
    cached.cache.del('header:/hello')
    server = new http.Server(cached.handler).listen(port, done)
  })

  it('miss /hello', (done) => {
    request(server)
      .get('/hello')
      .end((err, res) => {
        expect(res.text).to.eq('hello')
        done()
      })
  })

  it('hit GET /hello', (done) => {
    request(server)
      .get('/hello')
      .end((err, res) => {
        expect(res.text).to.eq('hello')
        done()
      })
  })

  it('hit HEAD /hello', (done) => {
    request(server)
      .head('/hello')
      .end((err, res) => {
        expect(res.status).to.eq(200)
        done()
      })
  })

  it('stale /hello', (done) => {
    setTimeout(() => {
      request(server)
        .get('/hello')
        .end((err, res) => {
          expect(res.text).to.eq('hello')
          done()
        })
    }, 1000)
  }).timeout(5000)

  it('update /hello', (done) => {
    request(server)
      .get('/hello')
      .end((err, res) => {
        expect(res.text).to.eq('hello')
      })
    setTimeout(() => {
      done()
    }, 1000)
  }).timeout(5000)

  it('update /hello-304', (done) => {
    request(server)
      .get('/hello-304')
      .end((err, res) => {
        expect(res.status).to.eq(304)
        done()
      })
  })

  it('miss /hello-zip', (done) => {
    request(server)
      .get('/hello-zip')
      .end((err, res) => {
        expect(res.text).to.eq('hello')
        done()
      })
  })

  it('bypass /unknown', (done) => {
    request(server)
      .get('/unknown')
      .end((err, res) => {
        expect(res.status).to.eq(404)
        done()
      })
  })

  after(() => {
    server.close()
    cached.close()
  })
})

describe('cached handler', () => {
  let cached: CachedHandler
  let server: http.Server

  before((done) => {
    const port = 3001
    cached = new CachedHandler(handler, { port, quiet: true })
    server = new http.Server(cached.handler).listen(port, done)
  })

  it('bypass /unknown', (done) => {
    request(server)
      .get('/unknown')
      .end((_, res) => {
        expect(res.status).to.eq(404)
        done()
      })
  })

  after(() => {
    server.close()
    cached.close()
  })
})
