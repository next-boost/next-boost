import { filterUrl, isZipped, log, mergeConfig } from '../src/utils'

export const sleep = async (t: number) => {
  return new Promise(resolve => setTimeout(resolve, t))
}

describe('utils', () => {
  it('is response zipped', () => {
    const headers = { 'content-encoding': 'application/gzip' }
    expect(isZipped(headers)).toBe(true)
    const headers2 = { 'content-encoding': 1 }
    expect(isZipped(headers2)).toBe(false)
    const headers3 = {}
    expect(isZipped(headers3)).toBe(false)
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
  })

  it('merge config / no config file', () => {
    const conf = mergeConfig()
    expect(conf.rules.length).toEqual(1)
    expect(conf.rules[0].regex).toEqual('.*')
    expect(conf.filename).toEqual('.next-boost.js')
  })

  it('merge config / default changed', () => {
    const conf = mergeConfig({ cache: { ttl: 1 } })
    expect(conf.rules.length).toEqual(1)
    expect(conf.rules[0].regex).toEqual('.*')
    expect(conf.filename).toEqual('.next-boost.js')
    expect(conf.cache.ttl).toEqual(1)
    expect(conf.cache.path).toBeUndefined()
  })

  it('merge config / with basic config', () => {
    const conf = mergeConfig({
      filename: '.next-boost.sample.js',
    })
    expect(conf.cache.path).toEqual('/tmp/jinja')
    expect(conf.rules.length).toEqual(2)
    expect(conf.rules[0].regex).toEqual('^/blog.*')
    expect(conf.filename).toEqual('.next-boost.sample.js')
  })

  it('merge config / conf file with no rules and no cache', () => {
    const conf = mergeConfig({
      filename: './test/fixtures/conf1.js',
    })
    expect(conf.cache.path).toBeUndefined()
    expect(conf.rules.length).toEqual(1)
    expect(conf.rules[0].regex).toEqual('.*')
    expect(conf.filename).toEqual('./test/fixtures/conf1.js')
  })

  it('merge config / conf file error', () => {
    expect(() =>
      mergeConfig({
        filename: './test/fixtures/conf2.txt',
      })
    ).toThrow(/Failed to load/)
  })

  it('filter url', () => {
    const url = `/path?p1=1&p2=2&p2=3`
    const rv1 = filterUrl(url)
    expect(rv1).toEqual(url)

    const rv2 = filterUrl(url, p => !p.startsWith('p'))
    expect(rv2).toEqual('/path')

    const rv3 = filterUrl(url, p => p !== 'p1')
    expect(rv3).toEqual('/path?p2=2&p2=3')
  })
})
