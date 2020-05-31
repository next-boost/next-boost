import mock from '@rjyo/mock-http'
import { IncomingMessage, ServerResponse } from 'http'
import { createHandler, launch } from './child'

export type RequestListener = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void> | void

type RenderOptions = {
  url: string
  method?: string
  headers?: { [key: string]: any }
}

type RenderResult = {
  statusCode: number
  headers: { [key: string]: any }
  body: Buffer
}

let handler: RequestListener

export type InitArgs = { script: string; args?: any }

const init = createHandler('init', async (args: InitArgs) => {
  const fn = require(args.script).default
  handler = await fn(args.args)
})

const render = createHandler(
  'renderer',
  async (options: RenderOptions): Promise<RenderResult> => {
    return new Promise((resolve) => {
      const req = new mock.Request(options)
      const res = new mock.Response({
        onFinish: () => {
          resolve({
            statusCode: res.statusCode,
            body: res._internal.buffer,
            headers: res._internal.headers,
          })
        },
      })
      handler(req, res)
    })
  }
)

export default () => {
  const child = launch(__filename)
  return {
    init: init(child),
    render: render(child),
    kill: () => child.kill(),
  }
}
