import { parse } from '../src/cli'

describe('cli parser', () => {
  it('no params', () => {
    const args = parse(['node', 'abc.js'])
    expect(args).toMatchObject({})
  })

  it('with args', () => {
    const args = parse(['node', 'abc.js', '--port', '123', '--hostname', 'abc'])
    expect(args).toMatchObject({
      '--port': 123,
      '--hostname': 'abc',
    })
  })

  it('with alias', () => {
    const args = parse(['node', 'abc.js', '-p', '123', '-H', 'abc', '-q'])
    expect(args).toMatchObject({
      '--port': 123,
      '--hostname': 'abc',
      '--quiet': true,
    })
  })

  it('with dir', () => {
    const args = parse(['node', 'abc.js', '.', '-p', '123', '-H', 'abc'])
    expect(args).toMatchObject({
      '--port': 123,
      '--hostname': 'abc',
      dir: '.',
    })
  })

  it('with dir at the end', () => {
    const args = parse(['node', 'abc.js', './.next'])
    expect(args).toMatchObject({
      dir: './.next',
    })
  })

  it('with wrong args', () => {
    expect(() => parse(['node', 'abc.js', '--x', '123'])).toThrow(/Failed/)
    expect(() => parse(['node', 'abc.js', '--p', '123'])).toThrow(/Failed/)
    // no value for non-boolean type
    expect(() => parse(['node', 'abc.js', '-p'])).toThrow(/Failed/)
  })

  it('using --help', () => {
    const argv = parse(['node', 'abc.js', '--help'])
    expect(argv).toBeUndefined()
  })
})
