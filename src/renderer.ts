import mock from '@rjyo/mock-http'
import { ChildProcess } from 'child_process'
import { IncomingMessage, ServerResponse } from 'http'
import { v4 as uuidv4 } from 'uuid'
import { fork } from './utils'

export type RequestListener = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void> | void

type RenderOptions = {
  uuid: string
  url: string
  method: string
  headers: { [key: string]: any }
}

type RenderFunction = (options: RenderOptions) => Promise<void>

type InitArgs = { [key: string]: any }

type InitCommand = {
  type: 'init'
  script: string
  args: InitArgs
}

type RenderCommand = {
  type: 'render'
  options: RenderOptions
}

type RenderResult = {
  uuid: string
  statusCode: number
  headers: { [key: string]: any }
  body: Buffer
}

type Commands = InitCommand | RenderCommand

type RenderCallback = (
  statusCode: number,
  headers: { [key: string]: any },
  body: Buffer
) => void

type MappedJobs = { [key: string]: RenderCallback }

let render: RenderFunction

export function createRenderFunction(handler: RequestListener) {
  const renderer: RenderFunction = async (options) => {
    const req = new mock.Request(options)
    const res = new mock.Response({
      onFinish: () => {
        const payload: RenderResult = {
          uuid: options.uuid,
          statusCode: res.statusCode,
          body: res._internal.buffer,
          headers: res._internal.headers,
        }
        process.send(payload)
      },
    })
    await handler(req, res)
  }
  return renderer
}

process.on('message', async (msg) => {
  const payload = JSON.parse(msg) as Commands
  if (payload.type === 'init') {
    const createHandler = require(payload.script).default
    const handler = await createHandler(payload.args)
    render = createRenderFunction(handler)
  } else {
    render(payload.options)
  }
})

export default class Renderer {
  private sub: ChildProcess
  private jobs: MappedJobs = {}
  handler: RequestListener

  constructor(script: string, args?: InitArgs) {
    console.log('> Preparing renderer')
    this.sub = fork(__filename)

    this.send<InitCommand>({
      type: 'init',
      script,
      args,
    })

    const createHandler = require(script).default
    createHandler(args).then((h: RequestListener) => {
      this.handler = h
    })

    this.sub.on('message', (msg: RenderResult) => {
      const job = this.jobs[msg.uuid]
      job(msg.statusCode, msg.headers, Buffer.from(msg.body))
    })
  }

  private send<T extends Commands>(msg: T): void {
    this.sub.send(JSON.stringify(msg))
  }

  render(req: IncomingMessage, callback: RenderCallback): void {
    const uuid = uuidv4()
    this.send<RenderCommand>({
      type: 'render',
      options: {
        uuid,
        headers: req.headers,
        method: req.method,
        url: req.url,
      },
    })
    this.jobs[uuid] = callback
  }

  stop(): void {
    this.sub.kill()
  }
}
