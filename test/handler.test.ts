import http from 'http'
import request from 'supertest'
import CachedHandler from '../src/handler'

type CHReturn = ReturnType<typeof CachedHandler> extends Promise<infer T>
  ? T
  : never

describe('cached handler', () => {
  let cached: CHReturn
  let server: http.Server

  beforeAll(async function () {
    const script = require.resolve('./mock')
    cached = await CachedHandler(
      { script },
      { rules: [{ regex: '/hello.*', ttl: 0.5 }] }
    )
    cached.cache.del('body:/hello')
    cached.cache.del('header:/hello')
    server = new http.Server(cached.handler)
  })

  it('404 with wrong method', done => {
    request(server).delete('/404').expect(404).end(done)
  })

  it('miss /hello', done => {
    request(server)
      .get('/hello')
      .end((err, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  it('hit GET /hello', done => {
    request(server)
      .get('/hello')
      .end((err, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  it('hit HEAD /hello', done => {
    request(server)
      .head('/hello')
      .end((err, res) => {
        expect(res.status).toEqual(200)
        done()
      })
  })

  it('stale /hello', done => {
    setTimeout(() => {
      request(server)
        .get('/hello')
        .end((err, res) => {
          expect(res.text).toEqual('hello')
          done()
        })
    }, 1000)
  })

  it('update /hello', done => {
    request(server)
      .get('/hello')
      .end((err, res) => {
        expect(res.text).toEqual('hello')
      })
    setTimeout(() => {
      done()
    }, 1000)
  })

  it('update /hello-304', done => {
    request(server)
      .get('/hello-304')
      .end((err, res) => {
        expect(res.status).toEqual(304)
        done()
      })
  })

  it('miss /hello-zip', done => {
    request(server)
      .get('/hello-zip')
      .end((err, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  it('bypass /unknown', done => {
    request(server)
      .get('/unknown')
      .end((err, res) => {
        expect(res.status).toEqual(404)
        done()
      })
  })

  it('force update /hello', done => {
    request(server)
      .get('/hello')
      .set('x-cache-status', 'update')
      .end((err, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  it('force update /hello-empty', done => {
    request(server)
      .get('/hello-empty')
      .set('x-cache-status', 'update')
      .end((err, res) => {
        expect(res.status).toEqual(200)
        done()
      })
  })

  afterAll(() => {
    server.close()
    cached.close()
  })
})

describe('cached handler with different conf', () => {
  let cached: CHReturn
  let server: http.Server

  beforeAll(async function () {
    const script = require.resolve('./mock')
    cached = await CachedHandler({ script }, { paramFilter: () => true })
    server = new http.Server(cached.handler)
  })

  it('bypass /unknown', done => {
    request(server)
      .get('/unknown')
      .end((_, res) => {
        expect(res.status).toEqual(404)
        done()
      })
  })

  afterAll(() => {
    server.close()
    cached.close()
  })
})
