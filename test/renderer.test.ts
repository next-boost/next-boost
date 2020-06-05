import { expect } from 'chai'
import Renderer from '../src/renderer'

describe('renderer', () => {
  let renderer: ReturnType<typeof Renderer>

  before(async function () {
    this.timeout(10000)
    const script = require.resolve('./mock')
    renderer = Renderer()
    await renderer.init({ script })
  })

  it('render correctly', async () => {
    const { statusCode, body } = await renderer.render({
      path: '/hello',
      method: 'GET',
    })
    expect(statusCode).eq(200)
    const b = Buffer.from(body)
    expect(b).to.be.instanceof(Buffer)
    expect(b.toString()).to.eq('hello')
  })

  after(() => {
    renderer.kill()
  })
})
