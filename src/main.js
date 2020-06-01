const { launch, createHandler } = require('./worker')

const test = createHandler('test', (name) => {
  console.log('in test', name)
  return 123
})

module.exports = function main() {
  const worker = launch(__filename)
  return {
    test: test(worker),
  }
}
