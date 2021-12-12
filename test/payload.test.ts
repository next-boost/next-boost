import { decodePayload, encodePayload } from '../src/payload'

describe('payload encode/decode', () => {
  it('encode', () => {
    const headers = { a: 1, b: 2 }
    const body = Buffer.from('hello world')
    const payload = encodePayload({ headers, body })
    const rv = decodePayload(payload)
    expect(rv.headers).toEqual(headers)
    expect(rv.body).toEqual(body)
  })

  it('encode with empty header', () => {
    const headers = null
    const body = Buffer.from('hello world')
    const payload = encodePayload({ headers, body })
    const rv = decodePayload(payload)
    expect(rv.headers).toBeNull()
    expect(rv.body).toEqual(body)
  })

  it('encode with empty body', () => {
    const headers = { a: 1, b: 2 }
    const body = null
    const payload = encodePayload({ headers, body })
    const rv = decodePayload(payload)
    expect(rv.headers).toEqual(headers)
    expect(rv.body).toEqual(Buffer.alloc(0))
  })

  it('invalid payload', () => {
    const payload = Buffer.from('hello world')
    expect(() => decodePayload(payload)).toThrow('Invalid payload')
  })
})
