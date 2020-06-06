import http from 'http'
import Multee from 'multee'

const { createHandler, start } = Multee('worker')

export type RequestListener = (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => Promise<void> | void

type RenderOptions = {
  path?: string
  method?: string
  headers?: { [key: string]: any }
}

export type RenderResult = {
  statusCode: number
  headers: { [key: string]: any }
  body: unknown
}

let server: http.Server

export type InitArgs = { script: string; args?: any }

const init = createHandler('init', async (args: InitArgs) => {
  const fn = require(args.script).default
  server = new http.Server(await fn(args.args)).listen(0)
})

const render = createHandler(
  'renderer',
  async (options: RenderOptions): Promise<RenderResult> => {
    return new Promise((resolve, reject) => {
      const addr = server.address()
      if (typeof addr !== 'object') {
        return reject('Failed to create server in renderer')
      }
      const args = { hostname: '127.0.0.1', port: addr.port, ...options }
      const req = http.request(args, (res) => {
        let body = Buffer.from('')
        res.on('data', (chunk) => (body = Buffer.concat([body, chunk])))
        res.on('end', () =>
          resolve({ headers: res.headers, statusCode: res.statusCode, body })
        )
      })
      req.on('error', (e) => reject(`Failed in renderer: ${e.message}`))
      req.end()
    })
  }
)

export default () => {
  const child = start(__filename)
  return {
    init: init(child),
    render: render(child),
    kill: () => child.terminate(),
  }
}
