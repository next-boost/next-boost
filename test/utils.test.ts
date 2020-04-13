import { expect } from 'chai'
import http from 'http'
import { isZipped, log, shouldZip, wrappedResponse } from '../src/utils'
import { sleep } from './cache.test'

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
    log(start, 'mis', 'A')
    log(start, 'rvl', 'A')
    log(start, 'prg', 'A')
    log(start, 'hit', 'A')
    await sleep(100)
    log(start, 'hit', 'A')
    await sleep(1000)
    log(start, 'hit', 'A')
  })

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
})
