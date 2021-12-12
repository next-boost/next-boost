import http from 'http'
import Cache from 'next-boost-hdc-adapter'
import request from 'supertest'
import { gzipSync } from 'zlib'

import { serveCache } from '../src/cache-manager'

describe('serve cache', () => {
  const cache = Cache.init()
  let url: string
  let server: http.Server

  beforeAll(async () => {
    url = '/p1'
    await cache.set('body:' + url, gzipSync(Buffer.from('AAA')))
    const data = Buffer.from(JSON.stringify({ 'header-x': 'value-x' }))
    await cache.set('header:' + url, data)

    server = new http.Server(async (req, res) => {
      const { status } = await serveCache(cache, req.url, false, res)
      expect(status).toEqual('hit')
    })
  })

  it('cached contents', done => {
    request(server)
      .get(url)
      .expect(200)
      .end((err, res) => {
        expect(err).toBeNull()
        expect(res.text).toEqual('AAA')
        expect(res.header['header-x']).toEqual('value-x')
        done()
      })
  })

  it('skip cache when x-cache-status = update', done => {
    const server = new http.Server(async (req, res) => {
      const fc = req.headers['x-cache-status'] === 'update' // forced
      const { status, stop } = await serveCache(cache, req.url, fc, res)
      expect(status).toEqual('force')
      expect(stop).toBeFalsy()
      res.end('BBB')
    })
    request(server)
      .get(url)
      .set('accept-encoding', '')
      .set('x-cache-status', 'update')
      .expect(200)
      .end((err, res) => {
        expect(res.text).toEqual('BBB')
        done()
      })
  })

  afterAll(() => {
    Cache.shutdown()
  })
})
