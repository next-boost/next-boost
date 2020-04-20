import { expect } from 'chai'
import http from 'http'
import {
  isZipped,
  log,
  shouldZip,
  wrappedResponse,
  mergeConfig,
} from '../src/utils'

export const sleep = async (t: number) => {
  return new Promise((resolve) => setTimeout(resolve, t))
}

describe('utils', () => {
  it('is response zipped', () => {
    const req = new http.IncomingMessage(null)
    const res = new http.ServerResponse(req)
    res.setHeader('content-encoding', 'gzip')
    expect(isZipped(res)).to.be.true
    res.setHeader('content-encoding', 1)
    expect(isZipped(res)).to.be.false
  })

  it('should request be zipped', () => {
    const req = new http.IncomingMessage(null)
    req.headers['accept-encoding'] = 'gzip, deflate'
    expect(shouldZip(req)).to.be.true
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

  it('wrapped response', () => {
    const req = new http.IncomingMessage(null)
    const res = new http.ServerResponse(req)
    const cache: { [key: string]: any } = {}
    const wrapped = wrappedResponse(res, cache)
    wrapped.write('Test')
    wrapped.write(Buffer.from('/X/'))
    wrapped.end()
    expect(cache.body).to.deep.eq(Buffer.from('Test/X/'))
  })

  it('merge config / no config file', () => {
    const conf = mergeConfig()
    expect(conf.hostname).to.eq('localhost')
    expect(conf.port).to.eq(3000)
    expect(conf.rules.length).to.eq(1)
    expect(conf.rules[0].regex).to.eq('.*')
    expect(conf.filename).to.eq('.next-boost.js')
  })

  it('merge config / default changed', () => {
    const conf = mergeConfig({ cache: { ttl: 1 } })
    expect(conf.hostname).to.eq('localhost')
    expect(conf.port).to.eq(3000)
    expect(conf.rules.length).to.eq(1)
    expect(conf.rules[0].regex).to.eq('.*')
    expect(conf.filename).to.eq('.next-boost.js')
    expect(conf.cache.ttl).to.eq(1)
    expect(conf.cache.path).to.be.undefined
  })

  it('merge config / with basic config', () => {
    const conf = mergeConfig({
      hostname: 'abc.com',
      filename: '.next-boost.sample.js',
    })
    expect(conf.hostname).to.eq('abc.com')
    expect(conf.port).to.eq(3000)
    expect(conf.cache.path).to.eq('/tmp/jinja')
    expect(conf.rules.length).to.eq(2)
    expect(conf.rules[0].regex).to.eq('^/blog.*')
    expect(conf.filename).to.eq('.next-boost.sample.js')
  })

  it('merge config / conf file with no rules and no cache', () => {
    const conf = mergeConfig({
      hostname: 'abc.com',
      filename: './test/fixtures/conf1.js',
    })
    expect(conf.hostname).to.eq('abc.com')
    expect(conf.port).to.eq(3000)
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
