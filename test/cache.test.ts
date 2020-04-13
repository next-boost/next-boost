import { expect } from 'chai'
import fs from 'fs'
import Cache from '../src/cache'

const sleep = async (t: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, t)
  })
}

describe('disk cache with ttl', () => {
  it('init', () => {
    const cache = new Cache()
    expect(fs.existsSync(cache.dbPath)).to.be.true
  })

  it('init with params', () => {
    const cache = new Cache({ ttl: 100, tbd: 300 })
    expect(cache.ttl).to.eq(100)
    expect(cache.tbd).to.eq(300)
    expect(cache.dbPath).to.eq('/tmp/.cache.db')
  })

  it('set / get', () => {
    const cache = new Cache()
    const v = 'B'
    cache.set('A', v)
    expect(cache.get('A')).to.eq(v)

    const v2 = Buffer.from('AAA')
    cache.set('A', v2)
    expect(cache.get('A')).to.deep.eq(v2)

    expect(cache.get('B', 'AA')).to.eq('AA')
  })

  it('set / get stale / hit / miss', async () => {
    const cache = new Cache()
    const key = 'key:1'
    cache.set(key, 1, 0.8)
    let s = cache.status(key)
    expect(s).to.eq('hit')
    await sleep(1000)
    s = cache.status(key)
    expect(s).to.eq('stale')
    const v = cache.get(key)
    expect(v).to.eq(1)
    s = cache.status('key:2')
    expect(s).to.eq('miss')

    cache.purge()
  })

  it('del / get miss', () => {
    const cache = new Cache()
    cache.set('A', 1)
    expect(cache.get('A')).to.eq(1)
    cache.del('A')
    expect(cache.get('A')).to.be.undefined
  })
})
