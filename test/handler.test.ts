import { expect } from 'chai'
import http from 'http'
import request from 'supertest'
import CachedHandler from '../src/handler'
// import Renderer from '../src/renderer'
// import Renderer from '../src/renderer2'
type CHReturn = ReturnType<typeof CachedHandler> extends Promise<infer T>
  ? T
  : never

describe('cached handler', () => {
  let cached: CHReturn
  let server: http.Server

  before(async function () {
    this.timeout(10000)
    const script = require.resolve('./mock')
    cached = await CachedHandler(
      { script },
      { rules: [{ regex: '/hello.*', ttl: 0.5 }] }
    )
    cached.cache.del('body:/hello')
    cached.cache.del('header:/hello')
    server = new http.Server(cached.handler)
  })

  it('miss /hello', (done) => {
    request(server)
      .get('/hello')
      .end((err, res) => {
        expect(res.text).to.eq('hello')
        done()
      })
  }).timeout(5000)

  it('hit GET /hello', (done) => {
    request(server)
      .get('/hello')
      .end((err, res) => {
        expect(res.text).to.eq('hello')
        done()
      })
  }).timeout(5000)

  it('hit HEAD /hello', (done) => {
    request(server)
      .head('/hello')
      .end((err, res) => {
        expect(res.status).to.eq(200)
        done()
      })
  }).timeout(5000)

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

  it('force update /hello', (done) => {
    request(server)
      .get('/hello')
      .set('x-cache-status', 'update')
      .end((err, res) => {
        expect(res.text).to.eq('hello')
        done()
      })
  }).timeout(100000)

  it('force update /hello-empty', (done) => {
    request(server)
      .get('/hello-empty')
      .set('x-cache-status', 'update')
      .end((err, res) => {
        expect(res.status).to.eq(200)
        done()
      })
  })

  after(() => {
    server.close()
    cached.close()
  })
})

describe('cached handler with different conf', () => {
  let cached: CHReturn
  let server: http.Server

  before(async function () {
    const script = require.resolve('./mock')
    cached = await CachedHandler(
      { script },
      { quiet: true, paramFilter: () => true }
    )
    server = new http.Server(cached.handler)
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
