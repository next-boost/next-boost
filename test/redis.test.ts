import http from 'http'
import request from 'supertest'

import { Adapter } from '@next-boost/redis-cache'

import CachedHandler from '../src/handler'
import { sleep } from '../src/utils'

type CHReturn = ReturnType<typeof CachedHandler> extends Promise<infer T> ? T : never

describe('cached handler', () => {
  let cached: CHReturn
  let server: http.Server
  let hit = 0
  let miss = 0
  let stale = 0
  let force = 0
  let bypass = 0

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
        metrics: true,
      },
    )
    await cached.cache.del('payload:/hello')
    await cached.cache.del('payload:/hello-304')
    await cached.cache.del('payload:/hello-zip')
    server = new http.Server(cached.handler)
  })

  it('404 with wrong method', done => {
    request(server)
      .delete('/404')
      .expect(404)
      .end(() => {
        bypass++
        done()
      })
  })

  it('miss /hello', done => {
    request(server)
      .get('/hello')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        miss++
        done()
      })
  })

  it('hit GET /hello', done => {
    request(server)
      .get('/hello')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        hit++
        done()
      })
  })

  it('hit HEAD /hello', done => {
    request(server)
      .head('/hello')
      .end((_, res) => {
        expect(res.status).toEqual(200)
        hit++
        done()
      })
  })

  it('stale /hello', done => {
    setTimeout(() => {
      request(server)
        .get('/hello')
        .end((_, res) => {
          expect(res.text).toEqual('hello')
          stale++
          done()
        })
    }, 2000)
  })

  it('update /hello', done => {
    request(server)
      .get('/hello')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        stale++
        done()
      })
  })

  it('miss /hello-304', done => {
    request(server)
      .get('/hello-304')
      .end((_, res) => {
        expect(res.status).toEqual(304)
        miss++
        done()
      })
  })

  it('miss /hello-zip', done => {
    request(server)
      .get('/hello-zip')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        miss++
        done()
      })
  })

  it('bypass /unknown', done => {
    request(server)
      .get('/unknown')
      .end((_, res) => {
        expect(res.status).toEqual(404)
        bypass++
        done()
      })
  })

  it('force update /hello', done => {
    request(server)
      .get('/hello')
      .set('x-next-boost', 'update')
      .end((_, res) => {
        expect(res.text).toEqual('hello')
        force++
        done()
      })
  })

  it('force update /hello-empty', done => {
    request(server)
      .get('/hello-empty')
      .set('x-next-boost', 'update')
      .end((_, res) => {
        expect(res.status).toEqual(200)
        force++
        done()
      })
  })

  it('have stats', done => {
    request(server)
      .get('/__nextboost_metrics')
      .end((_, res) => {
        expect(res.status).toEqual(200)
        expect(res.text).toContain(`next_boost_requests_total{status='hit'} ${hit}`)
        expect(res.text).toContain(`next_boost_requests_total{status='stale'} ${stale}`)
        expect(res.text).toContain(`next_boost_requests_total{status='miss'} ${miss}`)
        expect(res.text).toContain(`next_boost_requests_total{status='force'} ${force}`)
        expect(res.text).toContain(`next_boost_requests_total{status='bypass'} ${bypass}`)
        done()
      })
  })

  afterAll(async () => {
    await sleep(1000) // wait all data written, don't know why
    await cached.close()
    server.close()
  })
})
