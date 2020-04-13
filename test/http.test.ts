import { expect } from 'chai'
import http from 'http'
import request from 'supertest'
import { gzipSync } from 'zlib'
import Cache from '../src/cache'
import { serveCache } from '../src/utils'

describe('serve cache', () => {
  const cache = new Cache()
  const url = '/p1'
  cache.set('body:' + url, gzipSync(Buffer.from('AAA')))
  cache.set('header:' + url, { 'header-x': 'value-x' })
  const server = new http.Server((req, res) => serveCache(cache, req, res))

  it('client support gzip', (done) => {
    request(server)
      .get(url)
      .expect(200)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res.text).to.eq('AAA')
        expect(res.header['header-x']).to.eq('value-x')
        done()
      })
  })

  it('client does not support gzip', (done) => {
    request(server)
      .get(url)
      .set('accept-encoding', '')
      .expect(200)
      .end((err, res) => {
        expect(err).to.be.null
        expect(res.text).to.eq('AAA')
        expect(res.header['header-x']).to.eq('value-x')
        done()
      })
  })
})
