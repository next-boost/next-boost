const { v4: uuidv4 } = require('uuid')
const { Worker, parentPort, isMainThread } = require('worker_threads')

const handlers = {}
const waitingForResolve = {}

if (!isMainThread) {
  parentPort.on('message', async (payload) => {
    const worker = handlers[payload.name]
    const rv = await worker(payload.args)
    parentPort.postMessage({
      uuid: payload.uuid,
      result: rv,
    })
  })
}

exports.launch = (filename) => {
  const worker = new Worker(require.resolve(filename))
  worker.on('message', (payload) => {
    const cb = waitingForResolve[payload.uuid]
    cb(payload.result)
  })
  return worker
}

exports.createHandler = (name, handler) => {
  const caller = (worker) => (args) => {
    const uuid = uuidv4()
    worker.postMessage({ name, uuid, args })
    return new Promise((r) => (waitingForResolve[uuid] = r))
  }
  handlers[name] = handler
  return caller
}
