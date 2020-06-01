import { launch, createHandler } from './worker'

const test = createHandler('test', (name: string) => {
  console.log('in test', name)
  return 123
})

export default function main() {
  const worker = launch(__filename)
  return {
    test: test(worker),
  }
}
