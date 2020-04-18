import { expect } from 'chai'
import http from 'http'
import Cache from 'hybrid-disk-cache'
import { AddressInfo } from 'net'
import {
  initPurgeTimer,
  revalidate,
  stopPurgeTimer,
} from '../src/cache-manager'
import { mergeConfig } from '../src/utils'

describe('cache manager', () => {
  it('init and revalidate', (done) => {
    const url = '/aaa'
    const server = new http.Server((req, res) => {
      res.end()
      expect(req.headers['x-cache-status']).to.eq('update')
      expect(req.url).to.eq(url)
      setTimeout(() => {
        server.close()
        stopPurgeTimer()
        done()
      }, 500)
    })
    server.listen()
    const conf = mergeConfig({
      hostname: null,
      port: (server.address() as AddressInfo).port,
    })
    conf.cache.tbd = 0.5
    const cache = new Cache(conf.cache)
    initPurgeTimer(cache)
    revalidate(conf, url)
    revalidate(conf, url) // ignored
  }).timeout(5000)
})
