import Renderer from '../src/renderer'

describe('renderer', () => {
  let renderer: ReturnType<typeof Renderer>

  beforeAll(async function () {
    const script = require.resolve('./mock')
    renderer = Renderer()
    await renderer.init({ script })
  })

  it('render correctly', async () => {
    const { statusCode, body } = await renderer.render({
      path: '/hello',
      method: 'GET',
    })
    expect(statusCode).toEqual(200)
    const b = Buffer.from(body)
    expect(b).toBeInstanceOf(Buffer)
    expect(b.toString()).toEqual('hello')
  })

  afterAll(() => {
    renderer.kill()
  })
})
