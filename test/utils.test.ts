import { expect } from 'chai'
import { isZipped, log, mergeConfig } from '../src/utils'

export const sleep = async (t: number) => {
  return new Promise((resolve) => setTimeout(resolve, t))
}

describe('utils', () => {
  it('is response zipped', () => {
    const headers = { 'content-encoding': 'application/gzip' }
    expect(isZipped(headers)).to.be.true
    const headers2 = { 'content-encoding': 1 }
    expect(isZipped(headers2)).to.be.false
    const headers3 = {}
    expect(isZipped(headers3)).to.be.false
  })

  it('log with hrtime', async () => {
    const start = process.hrtime()
    log(start, 'miss', 'A')
    await sleep(100)
    log(start, 'hit', 'A')
    await sleep(1000)
    log(start, 'hit', 'A')
    await sleep(1000)
    log(start, 'hit', 'A')
  }).timeout(5000)

  it('merge config / no config file', () => {
    const conf = mergeConfig()
    expect(conf.rules.length).to.eq(1)
    expect(conf.rules[0].regex).to.eq('.*')
    expect(conf.filename).to.eq('.next-boost.js')
  })

  it('merge config / default changed', () => {
    const conf = mergeConfig({ cache: { ttl: 1 } })
    expect(conf.rules.length).to.eq(1)
    expect(conf.rules[0].regex).to.eq('.*')
    expect(conf.filename).to.eq('.next-boost.js')
    expect(conf.cache.ttl).to.eq(1)
    expect(conf.cache.path).to.be.undefined
  })

  it('merge config / with basic config', () => {
    const conf = mergeConfig({
      filename: '.next-boost.sample.js',
    })
    expect(conf.cache.path).to.eq('/tmp/jinja')
    expect(conf.rules.length).to.eq(2)
    expect(conf.rules[0].regex).to.eq('^/blog.*')
    expect(conf.filename).to.eq('.next-boost.sample.js')
  })

  it('merge config / conf file with no rules and no cache', () => {
    const conf = mergeConfig({
      filename: './test/fixtures/conf1.js',
    })
    expect(conf.cache.path).to.be.undefined
    expect(conf.rules.length).to.eq(1)
    expect(conf.rules[0].regex).to.eq('.*')
    expect(conf.filename).to.eq('./test/fixtures/conf1.js')
  })

  it('merge config / conf file error', () => {
    expect(() =>
      mergeConfig({
        filename: './test/fixtures/conf2.txt',
      })
    ).to.throw(/Failed to load/)
  })
})
