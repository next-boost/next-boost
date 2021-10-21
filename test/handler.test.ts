import http from 'http'
import request from 'supertest'
import CachedHandler from '../src/handler'

type CHReturn = ReturnType<typeof CachedHandler> extends Promise<infer T>
  ? T
  : never

describe('cached handler', () => {
  let cached: CHReturn
  let server: http.Server

  beforeAll(async () => {
    const script = require.resolve('./mock')
    cached = await CachedHandler(
      { script },
      { rules: [{ regex: '/hello.*', ttl: 0.5 }], quiet: true }
    )
    await cached.cache.del('body:/hello')
    await cached.cache.del('header:/hello')
    server = new http.Server(cached.handler)
  })

  it('404 with wrong method', done => {
    request(server).delete('/404').expect(404).end(done)
  })

  it('miss /hello', done => {
    request(server)
      .get('/hello')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  it('hit GET /hello', done => {
    request(server)
      .get('/hello')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  it('hit HEAD /hello', done => {
    request(server)
      .head('/hello')
      .end((_, res) => {
        expect(res.status).toEqual(200)
        done()
      })
  })

  it('stale /hello', done => {
    setTimeout(() => {
      request(server)
        .get('/hello')
        .end((_, res) => {
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
      .end((_, res) => {
        expect(res.status).toEqual(304)
        done()
      })
  })

  it('miss /hello-zip', done => {
    request(server)
      .get('/hello-zip')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  it('bypass /unknown', done => {
    request(server)
      .get('/unknown')
      .end((_, res) => {
        expect(res.status).toEqual(404)
        done()
      })
  })

  it('force update /hello', done => {
    request(server)
      .get('/hello')
      .set('x-cache-status', 'update')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  it('force update /hello-empty', done => {
    request(server)
      .get('/hello-empty')
      .set('x-cache-status', 'update')
      .end((_, res) => {
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
    cached = await CachedHandler(
      { script },
      {
        quiet: false,
        paramFilter: () => true,
        cacheKey: req => {
          return req.url + '_001'
        },
      }
    )
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

  it('use the custom cache key: miss', done => {
    request(server)
      .get('/hello')
      .end(async (_, res) => {
        expect(res.text).toEqual('hello')
        expect(await cached.cache.has('body:/hello_001')).toEqual('hit')
        done()
      })
  })

  it('use the custom cache key: hit', done => {
    request(server)
      .get('/hello')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  afterAll(() => {
    server.close()
    cached.close()
  })
})

describe('cached handler with paramFilter conf', () => {
  let cached: CHReturn
  let server: http.Server

  beforeAll(async () => {
    const script = require.resolve('./mock')
    cached = await CachedHandler(
      { script },
      {
        quiet: false,
        paramFilter: p => p !== 'p1',
      }
    )
    await cached.cache.del('body:/params?p2=2')
    server = new http.Server(cached.handler)
  })

  it('filters the param from the cache key', done => {
    request(server)
      .get('/params?p1=1&p2=2')
      .end(async (_, res) => {
        expect(res.text).toEqual('params')
        expect(await cached.cache.has('body:/params?p2=2')).toEqual('hit')
        done()
      })
  })

  afterAll(() => {
    server.close()
    cached.close()
  })
})

describe('cached handler with rules handler conf', () => {
  let cached: CHReturn
  let server: http.Server

  beforeAll(async () => {
    const script = require.resolve('./mock')
    cached = await CachedHandler(
      { script },
      {
        rules: req => {
          if (req.url === '/hello') {
            return 0.5
          }
        },
        quiet: true,
      }
    )
    await cached.cache.del('body:/hello')
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

  it('use the custom cache key: miss', done => {
    request(server)
      .get('/hello')
      .end(async (_, res) => {
        expect(res.text).toEqual('hello')
        expect(await cached.cache.has('body:/hello')).toEqual('hit')
        done()
      })
  })

  it('use the custom cache key: hit', done => {
    request(server)
      .get('/hello')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  afterAll(() => {
    server.close()
    cached.close()
  })
})
