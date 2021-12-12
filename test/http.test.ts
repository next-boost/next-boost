import http from 'http'
import request from 'supertest'
import { gzipSync } from 'zlib'

import Cache, { Adapter } from '@next-boost/hybrid-disk-cache'

import { send, serveCache } from '../src/cache-manager'
import { encodePayload } from '../src/payload'

describe('serve cache', () => {
  const adapter = new Adapter()
  let cache: Cache
  let url: string
  let server: http.Server

  beforeAll(async () => {
    cache = await adapter.init()
    url = '/p1'
    const headers = { 'header-x': 'value-x' }
    const data = encodePayload({ headers, body: gzipSync(Buffer.from('AAA')) })
    await cache.set('payload:' + url, data)

    server = new http.Server(async (req, res) => {
      const state = await serveCache(cache, req.url, false)
      expect(state.status).toEqual('hit')
      if (state.status === 'hit') {
        send(state.payload, res)
      }
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

  it('skip cache when x-next-boost = update', done => {
    const server = new http.Server(async (req, res) => {
      const fc = req.headers['x-next-boost'] === 'update' // forced
      const { status } = await serveCache(cache, req.url, fc)
      expect(status).toEqual('force')
      res.end('BBB')
    })
    request(server)
      .get(url)
      .set('accept-encoding', '')
      .set('x-next-boost', 'update')
      .expect(200)
      .end((err, res) => {
        expect(res.text).toEqual('BBB')
        done()
      })
  })

  afterAll(() => {
    adapter.shutdown()
  })
})

describe('serve bad cache', () => {
  const adapter = new Adapter()
  let cache: Cache
  let url: string
  let server: http.Server

  beforeAll(async () => {
    cache = await adapter.init()
    url = '/p1'
    await cache.set('payload:' + url, Buffer.from('abcdefg'))

    server = new http.Server(async (req, res) => {
      const state = await serveCache(cache, req.url, false)
      expect(state.status).toEqual('miss')
      const headers = { 'header-x': 'value-x' }
      send({ headers, body: gzipSync(Buffer.from('AAA')) }, res)
    })
  })

  it('error in cached content', done => {
    request(server)
      .get(url)
      .expect(200)
      .end((err, res) => {
        expect(err).toBeNull()
        expect(res.text).toEqual('AAA')
        done()
      })
  })

  afterAll(() => {
    adapter.shutdown()
  })
})
