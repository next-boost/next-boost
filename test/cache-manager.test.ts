import Cache from 'hybrid-disk-cache'
import { initPurgeTimer, stopPurgeTimer } from '../src/cache-manager'
import { mergeConfig } from '../src/utils'

describe('cache manager', () => {
  it('init and revalidate', (done) => {
    const conf = mergeConfig({})
    conf.cache.tbd = 0.5
    const cache = new Cache(conf.cache)
    cache.purge = () => {
      done()
      stopPurgeTimer()
      return 0
    }
    initPurgeTimer(cache)
    initPurgeTimer(cache)
  })
})
