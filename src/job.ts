import { launch, createHandler } from './child'

const init = createHandler(
  'init',
  async (args: { name: string; title: string }) => {
    const rv = `you are ${args.name}, ${args.title}`
    return rv
  }
)

export default () => {
  const child = launch(__filename)
  return {
    init: init(child),
    kill: () => child.kill(),
  }
}
