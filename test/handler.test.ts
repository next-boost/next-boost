import { expect } from 'chai'
import http from 'http'
import request from 'supertest'
import CachedHandler from '../src/handler'
import Renderer from '../src/renderer'

describe('cached handler', () => {
  let cached: CachedHandler
  let server: http.Server

  before(function (done) {
    this.timeout(10000)
    const script = require.resolve('./mock')
    const renderer = new Renderer(script, {})
    cached = new CachedHandler(renderer, {
      rules: [{ regex: '/hello.*', ttl: 0.5 }],
    })
    cached.cache.del('body:/hello')
    cached.cache.del('header:/hello')
    server = new http.Server(cached.handler)
    setTimeout(done, 2000)
  })

  it('miss /hello', (done) => {
    request(server)
      .get('/hello')
      .end((err, res) => {
        expect(res.text).to.eq('hello')
        done()
      })
  }).timeout(100000)

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

describe('cached handler quiet', () => {
  let cached: CachedHandler
  let server: http.Server

  before(function (done) {
    this.timeout(10000)
    const script = require.resolve('./mock')
    const renderer = new Renderer(script, {})
    cached = new CachedHandler(renderer, { quiet: true })
    server = new http.Server(cached.handler)
    setTimeout(done, 2000)
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
