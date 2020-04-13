import { expect } from 'chai'
import { parse } from '../src/cli'

describe('cli parser', () => {
  it('no params', () => {
    const args = parse(['node', 'abc.js'])
    expect(args).to.be.an('object').is.empty
  })

  it('with args', () => {
    const args = parse(['node', 'abc.js', '--port', '123', '--hostname', 'abc'])
    expect(args).to.be.an('object').has.keys(['--port', '--hostname'])
    expect(args['--port']).to.be.eq(123)
    expect(args['--hostname']).to.be.eq('abc')
  })

  it('with alias', () => {
    const args = parse(['node', 'abc.js', '-p', '123', '-H', 'abc'])
    expect(args).to.be.an('object').has.keys(['--port', '--hostname'])
    expect(args['--port']).to.be.eq(123)
    expect(args['--hostname']).to.be.eq('abc')
  })

  it('with dir', () => {
    const args = parse(['node', 'abc.js', '.', '-p', '123', '-H', 'abc'])
    expect(args).to.be.an('object').has.keys(['dir', '--port', '--hostname'])
    expect(args['--port']).to.be.eq(123)
    expect(args['--hostname']).to.be.eq('abc')
    expect(args['dir']).to.be.eq('.')
  })

  it('with dir at the end', () => {
    const args = parse(['node', 'abc.js', './.next'])
    expect(args).to.be.an('object').has.keys(['dir'])
    expect(args['dir']).to.be.eq('./.next')
  })

  it('with wrong args', () => {
    expect(() => parse(['node', 'abc.js', '--x', '123'])).to.throw(/Failed/)
    expect(() => parse(['node', 'abc.js', '--p', '123'])).to.throw(/Failed/)
    // no value for non-boolean type
    expect(() => parse(['node', 'abc.js', '-p'])).to.throw(/Failed/)
  })

  it('using --help', () => {
    const argv = parse(['node', 'abc.js', '--help'])
    expect(argv).is.undefined
  })
})
