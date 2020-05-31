import cp from 'child_process'
import { v4 as uuidv4 } from 'uuid'

function fork(modulePath: string) {
  const isTest = process.env.NODE_ENV === 'test'
  const options = isTest ? { execArgv: ['-r', 'ts-node/register'] } : null
  return cp.fork(modulePath, [], options)
}

const workers: Record<string, Handler<unknown, unknown>> = {}
const waitingForResolve: Record<string, (args: any) => void> = {}

type ActionPayload = {
  name: string
  uuid: string
  args: any
}

type ResultPayload = {
  uuid: string
  result: any
}

process.on('message', async (payload: ActionPayload) => {
  const worker = workers[payload.name]
  const rv = await worker(payload.args)
  process.send({
    uuid: payload.uuid,
    result: rv,
  })
})

type Handler<T, R> = (args?: T) => R | Promise<R>
type Runner<T, R> = (sub: cp.ChildProcess) => Handler<T, R>

export const launch = (filename: string) => {
  const sub = fork(filename)

  sub.on('message', (payload: ResultPayload) => {
    const cb = waitingForResolve[payload.uuid]
    cb(payload.result)
  })

  return sub
}

export const createHandler = <T, R>(
  name: string,
  worker: Handler<T, R>
): Runner<T, R> => {
  const caller: Runner<T, R> = (sub) => (args) => {
    const uuid = uuidv4()
    sub.send({ name, uuid, args })
    return new Promise((r) => (waitingForResolve[uuid] = r))
  }
  workers[name] = worker
  return caller
}
