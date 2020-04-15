import { expect } from 'chai'
import http from 'http'
import { AddressInfo } from 'net'
import Manger from '../src/cache-manager'
import { mergeConfig } from '../src/utils'

describe('cache manager', () => {
  it('init and revalidate', (done) => {
    const manager = Manger()
    const url = '/aaa'
    const server = new http.Server((req, res) => {
      res.end()
      expect(req.headers['x-cache-status']).to.eq('update')
      expect(req.url).to.eq(url)
      setTimeout(() => {
        server.close()
        manager.kill()
        done()
      }, 500)
    })
    server.listen()
    const conf = mergeConfig({
      hostname: null,
      port: (server.address() as AddressInfo).port,
    })
    conf.cache.tbd = 0.5
    manager.init(conf)
    manager.init(conf) // ignored
    manager.revalidate(url)
    manager.revalidate(url) // ignored
  }).timeout(5000)
})
