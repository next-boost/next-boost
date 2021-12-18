import http from 'http'
import request from 'supertest'

import { Adapter } from '@next-boost/redis-cache'

import CachedHandler from '../src/handler'
import { STATUSES } from '../src/stats'
import { sleep } from '../src/utils'

type CHReturn = ReturnType<typeof CachedHandler> extends Promise<infer T> ? T : never

describe('cached handler', () => {
  let cached: CHReturn
  let server: http.Server

  beforeAll(async () => {
    const script = require.resolve('./mock')
    cached = await CachedHandler(
      { script },
      {
        rules: [{ regex: '/hello.*', ttl: 2 }],
        quiet: false,
        cacheAdapter: new Adapter({
          uri: process.env.REDIS_URL || 'redis://localhost:6379',
          ttl: 10,
          tbd: 20,
        }),
      },
    )
    await cached.cache.del('payload:/hello')
    for (const s of STATUSES) {
      await cached.cache.del('stats:' + s)
    }
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
    }, 2000)
  })

  it('update /hello', done => {
    request(server)
      .get('/hello')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
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
      .set('x-next-boost', 'update')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        done()
      })
  })

  it('force update /hello-empty', done => {
    request(server)
      .get('/hello-empty')
      .set('x-next-boost', 'update')
      .end((_, res) => {
        expect(res.status).toEqual(200)
        done()
      })
  })

  it('have stats', done => {
    request(server)
      .get('/__nextboost_exporter')
      .end((_, res) => {
        expect(res.status).toEqual(200)
        expect(res.text).toMatch(/next_boost_requests_total{status='hit'} 2/)
        done()
      })
  })

  afterAll(async () => {
    await sleep(1000) // wait all data written, don't know why
    await cached.close()
    server.close()
  })
})
