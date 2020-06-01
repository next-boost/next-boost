import run from './main1'

const job = run()

async function test() {
  const rv = await job.test('hi')
  console.log(rv)
}

test()
